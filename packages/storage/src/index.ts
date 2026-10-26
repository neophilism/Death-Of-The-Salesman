import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

export const DEFAULT_MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;
const SAFE_UNSCANNED_MEDIA_TYPES = new Set(["application/json", "text/csv", "text/plain"]);
const IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;
const MEDIA_TYPE_PATTERN = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

export type ArtifactScanEvidence =
  | { readonly required: false; readonly status: "not-required" }
  | {
      readonly required: true;
      readonly status: "clean";
      readonly scanner: string;
      readonly scannedAt: string;
    };

export interface ArtifactMetadata {
  readonly organizationId: string;
  readonly artifactId: string;
  readonly version: number;
  readonly objectKey: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly createdAt: string;
  readonly scan: ArtifactScanEvidence;
}

export interface EncryptedArtifactRecord {
  readonly metadata: ArtifactMetadata;
  readonly encryption: {
    readonly algorithm: "aes-256-gcm";
    readonly keyId: string;
    readonly ivHex: string;
    readonly authTagHex: string;
  };
  readonly ciphertext: Uint8Array;
}

export interface ArtifactBackendCapabilities {
  readonly immutableVersions: boolean;
  readonly tenantScopedKeys: boolean;
  readonly versionedObjects: boolean;
}

export interface ArtifactObjectBackend {
  readonly capabilities: ArtifactBackendCapabilities;
  listVersions(organizationId: string, artifactId: string): Promise<readonly number[]>;
  putVersion(record: EncryptedArtifactRecord): Promise<void>;
  getVersion(
    organizationId: string,
    artifactId: string,
    version: number,
  ): Promise<EncryptedArtifactRecord | undefined>;
}

export interface PutArtifactRequest {
  readonly organizationId: string;
  readonly artifactId: string;
  readonly mediaType: string;
  readonly bytes: Uint8Array;
  readonly scan: ArtifactScanEvidence;
}

export interface EncryptedArtifactStoreOptions {
  readonly backend: ArtifactObjectBackend;
  readonly encryptionKey: Uint8Array;
  readonly keyId: string;
  readonly maxArtifactBytes?: number;
  readonly now?: () => Date;
}

const assertIdentifier = (value: string, label: string): void => {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${label} must be a bounded storage identifier`);
  }
};

const assertTimestamp = (value: string, label: string): void => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical UTC timestamp`);
  }
};

const assertScanEvidence = (mediaType: string, scan: ArtifactScanEvidence): void => {
  const requiresScan = !SAFE_UNSCANNED_MEDIA_TYPES.has(mediaType);
  if (typeof scan !== "object" || scan === null) {
    throw new Error("scan evidence must be an object");
  }
  if (requiresScan && (scan.required !== true || scan.status !== "clean")) {
    throw new Error(`${mediaType} requires clean malware-scan evidence before storage`);
  }
  if (scan.required === true) {
    if (
      scan.status !== "clean" ||
      typeof scan.scanner !== "string" ||
      scan.scanner.trim() === "" ||
      typeof scan.scannedAt !== "string"
    ) {
      throw new Error("required scan evidence must identify a clean scanner result");
    }
    assertTimestamp(scan.scannedAt, "scan.scannedAt");
  } else if (scan.required !== false || scan.status !== "not-required") {
    throw new Error("unscanned evidence must be explicitly not-required");
  }
};

const hashBytes = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const objectKeyFor = (organizationId: string, artifactId: string, version: number): string =>
  `tenants/${organizationId}/artifacts/${artifactId}/v${version}`;

const additionalDataFor = (metadata: ArtifactMetadata): Uint8Array =>
  Buffer.from(JSON.stringify({
    organizationId: metadata.organizationId,
    artifactId: metadata.artifactId,
    version: metadata.version,
    objectKey: metadata.objectKey,
    mediaType: metadata.mediaType,
    sizeBytes: metadata.sizeBytes,
    sha256: metadata.sha256,
  }), "utf8");

const assertBackendCapabilities = (backend: ArtifactObjectBackend): void => {
  const { immutableVersions, tenantScopedKeys, versionedObjects } = backend.capabilities;
  if (!immutableVersions || !tenantScopedKeys || !versionedObjects) {
    throw new Error("artifact backend must provide immutable, tenant-scoped versioned objects");
  }
};

export class InMemoryArtifactBackend implements ArtifactObjectBackend {
  readonly capabilities = Object.freeze({
    immutableVersions: true,
    tenantScopedKeys: true,
    versionedObjects: true,
  });
  readonly #records = new Map<string, EncryptedArtifactRecord>();

  async listVersions(organizationId: string, artifactId: string): Promise<readonly number[]> {
    assertIdentifier(organizationId, "organizationId");
    assertIdentifier(artifactId, "artifactId");
    const prefix = `tenants/${organizationId}/artifacts/${artifactId}/v`;
    return [...this.#records.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => Number.parseInt(key.slice(prefix.length), 10))
      .sort((left, right) => left - right);
  }

  async putVersion(record: EncryptedArtifactRecord): Promise<void> {
    const key = record.metadata.objectKey;
    if (this.#records.has(key)) throw new Error("artifact version already exists");
    this.#records.set(key, record);
  }

  async getVersion(
    organizationId: string,
    artifactId: string,
    version: number,
  ): Promise<EncryptedArtifactRecord | undefined> {
    return this.#records.get(objectKeyFor(organizationId, artifactId, version));
  }
}

export class EncryptedArtifactStore {
  readonly #backend: ArtifactObjectBackend;
  readonly #encryptionKey: Buffer;
  readonly #keyId: string;
  readonly #maxArtifactBytes: number;
  readonly #now: () => Date;

  constructor(options: EncryptedArtifactStoreOptions) {
    assertBackendCapabilities(options.backend);
    assertIdentifier(options.keyId, "keyId");
    if (options.encryptionKey.byteLength !== 32) {
      throw new Error("artifact encryption key must contain exactly 32 bytes");
    }
    const maxArtifactBytes = options.maxArtifactBytes ?? DEFAULT_MAX_ARTIFACT_BYTES;
    if (!Number.isSafeInteger(maxArtifactBytes) || maxArtifactBytes < 1) {
      throw new Error("maxArtifactBytes must be a positive safe integer");
    }
    this.#backend = options.backend;
    this.#encryptionKey = Buffer.from(options.encryptionKey);
    this.#keyId = options.keyId;
    this.#maxArtifactBytes = maxArtifactBytes;
    this.#now = options.now ?? (() => new Date());
  }

  async put(request: PutArtifactRequest): Promise<ArtifactMetadata> {
    assertIdentifier(request.organizationId, "organizationId");
    assertIdentifier(request.artifactId, "artifactId");
    const mediaType = request.mediaType.trim().toLowerCase();
    if (!MEDIA_TYPE_PATTERN.test(mediaType)) throw new Error("mediaType must be a valid MIME type");
    if (request.bytes.byteLength > this.#maxArtifactBytes) {
      throw new Error(`artifact exceeds the ${this.#maxArtifactBytes}-byte limit`);
    }
    assertScanEvidence(mediaType, request.scan);

    const versions = await this.#backend.listVersions(request.organizationId, request.artifactId);
    if (versions.some((version) => !Number.isSafeInteger(version) || version < 1)) {
      throw new Error("artifact backend returned an invalid version");
    }
    const version = (versions.at(-1) ?? 0) + 1;
    if (!Number.isSafeInteger(version)) throw new Error("artifact version limit reached");

    const bytes = Buffer.from(request.bytes);
    const metadata: ArtifactMetadata = Object.freeze({
      organizationId: request.organizationId,
      artifactId: request.artifactId,
      version,
      objectKey: objectKeyFor(request.organizationId, request.artifactId, version),
      mediaType,
      sizeBytes: bytes.byteLength,
      sha256: hashBytes(bytes),
      createdAt: this.#now().toISOString(),
      scan: Object.freeze({ ...request.scan }),
    });
    assertTimestamp(metadata.createdAt, "createdAt");

    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.#encryptionKey, iv);
    cipher.setAAD(additionalDataFor(metadata));
    const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
    const record: EncryptedArtifactRecord = Object.freeze({
      metadata,
      encryption: Object.freeze({
        algorithm: "aes-256-gcm",
        keyId: this.#keyId,
        ivHex: iv.toString("hex"),
        authTagHex: cipher.getAuthTag().toString("hex"),
      }),
      ciphertext,
    });
    await this.#backend.putVersion(record);
    return metadata;
  }

  async get(
    organizationId: string,
    artifactId: string,
    version: number,
  ): Promise<Uint8Array | undefined> {
    assertIdentifier(organizationId, "organizationId");
    assertIdentifier(artifactId, "artifactId");
    if (!Number.isSafeInteger(version) || version < 1) {
      throw new Error("version must be a positive safe integer");
    }
    const record = await this.#backend.getVersion(organizationId, artifactId, version);
    if (record === undefined) return undefined;
    const expectedObjectKey = objectKeyFor(organizationId, artifactId, version);
    if (
      record.metadata.organizationId !== organizationId ||
      record.metadata.artifactId !== artifactId ||
      record.metadata.version !== version ||
      record.metadata.objectKey !== expectedObjectKey
    ) {
      throw new Error("artifact backend crossed a tenant or object boundary");
    }
    if (record.encryption.algorithm !== "aes-256-gcm" || record.encryption.keyId !== this.#keyId) {
      throw new Error("artifact encryption metadata is unsupported");
    }

    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.#encryptionKey,
        Buffer.from(record.encryption.ivHex, "hex"),
      );
      decipher.setAAD(additionalDataFor(record.metadata));
      decipher.setAuthTag(Buffer.from(record.encryption.authTagHex, "hex"));
      const plaintext = Buffer.concat([
        decipher.update(record.ciphertext),
        decipher.final(),
      ]);
      if (
        plaintext.byteLength !== record.metadata.sizeBytes ||
        hashBytes(plaintext) !== record.metadata.sha256
      ) {
        throw new Error("artifact digest mismatch");
      }
      return plaintext;
    } catch {
      throw new Error("artifact authentication failed");
    }
  }
}


export const AVATAR_DISPLAY_SIZES = Object.freeze({
  compact: 40,
  standard: 64,
  profile: 96,
} as const);

export type AvatarDisplaySize = keyof typeof AVATAR_DISPLAY_SIZES;

export type AvatarRightsEvidence =
  | {
      readonly kind: "original";
      readonly creator: string;
      readonly attestedByMembershipId: string;
    }
  | {
      readonly kind: "user-licensed";
      readonly licenseReference: string;
      readonly attestedByMembershipId: string;
    };

export interface AvatarFallback {
  readonly kind: "monogram";
  readonly monogram: string;
  readonly accessibleName: string;
  readonly sizePixels: number;
}

export interface StoredAvatarPortrait {
  readonly kind: "portrait";
  readonly organizationId: string;
  readonly agentIdentityId: string;
  readonly displayName: string;
  readonly width: number;
  readonly height: number;
  readonly sizePixels: number;
  readonly image: ArtifactMetadata;
  readonly rightsManifest: ArtifactMetadata;
  readonly fallback: AvatarFallback;
}

export type AvatarPresentation =
  | AvatarFallback
  | {
      readonly kind: "image";
      readonly artifactId: string;
      readonly version: number;
      readonly accessibleName: string;
      readonly sizePixels: number;
      readonly fallback: AvatarFallback;
    };

const AVATAR_IDENTIFIER_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const avatarDisplayName = (value: string): string => {
  const displayName = value.trim().replace(/\s+/g, " ");
  if (!displayName || displayName.length > 120) {
    throw new Error("avatar displayName must contain 1 to 120 characters");
  }
  return displayName;
};

const monogramFor = (displayName: string): string => {
  const words = displayName.split(" ");
  const first = words[0] ?? "";
  const last = words.at(-1) ?? first;
  const initials = words.length === 1
    ? first.slice(0, 2)
    : `${first[0] ?? ""}${last[0] ?? ""}`;
  return initials.toLocaleUpperCase("en-US");
};

const avatarFallback = (
  displayName: string,
  size: AvatarDisplaySize,
): AvatarFallback => Object.freeze({
  kind: "monogram",
  monogram: monogramFor(displayName),
  accessibleName: `${displayName} avatar`,
  sizePixels: AVATAR_DISPLAY_SIZES[size],
});

const pngDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  const buffer = Buffer.from(bytes);
  if (
    buffer.byteLength < 24 ||
    !buffer.subarray(0, PNG_SIGNATURE.byteLength).equals(PNG_SIGNATURE) ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    throw new Error("avatar portrait must be a PNG with an IHDR header");
  }
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width < 32 || height < 32 || width > 2048 || height > 2048) {
    throw new Error("avatar portrait dimensions must be between 32 and 2048 pixels");
  }
  return { width, height };
};

const normalizedRights = (rights: AvatarRightsEvidence): AvatarRightsEvidence => {
  if (typeof rights !== "object" || rights === null) {
    throw new Error("avatar rights evidence is required");
  }
  if (!AVATAR_IDENTIFIER_PATTERN.test(rights.attestedByMembershipId)) {
    throw new Error("avatar rights evidence requires a bounded attesting membership");
  }
  if (rights.kind === "original") {
    const creator = rights.creator.trim();
    if (!creator || creator.length > 160) {
      throw new Error("original avatar rights evidence requires a bounded creator");
    }
    return Object.freeze({ ...rights, creator });
  }
  if (rights.kind === "user-licensed") {
    const licenseReference = rights.licenseReference.trim();
    if (!licenseReference || licenseReference.length > 240) {
      throw new Error("licensed avatar rights evidence requires a bounded license reference");
    }
    return Object.freeze({ ...rights, licenseReference });
  }
  throw new Error("avatar portraits must be original or user-licensed");
};

export const createAvatarFallback = (
  displayNameInput: string,
  size: AvatarDisplaySize = "standard",
): AvatarFallback => avatarFallback(avatarDisplayName(displayNameInput), size);

export const presentAvatar = (
  portrait: StoredAvatarPortrait | undefined,
  imageAccessible: boolean,
): AvatarPresentation => {
  if (!portrait || !imageAccessible) {
    return portrait?.fallback ?? createAvatarFallback("Unknown agent");
  }
  return Object.freeze({
    kind: "image",
    artifactId: portrait.image.artifactId,
    version: portrait.image.version,
    accessibleName: portrait.fallback.accessibleName,
    sizePixels: portrait.sizePixels,
    fallback: portrait.fallback,
  });
};

export class AvatarPipeline {
  readonly #store: EncryptedArtifactStore;

  constructor(store: EncryptedArtifactStore) {
    this.#store = store;
  }

  async storePortrait(input: {
    readonly organizationId: string;
    readonly agentIdentityId: string;
    readonly displayName: string;
    readonly mediaType: "image/png";
    readonly bytes: Uint8Array;
    readonly scan: ArtifactScanEvidence;
    readonly rights: AvatarRightsEvidence;
    readonly displaySize?: AvatarDisplaySize;
  }): Promise<StoredAvatarPortrait> {
    if (!AVATAR_IDENTIFIER_PATTERN.test(input.agentIdentityId)) {
      throw new Error("agentIdentityId must be a bounded storage identifier");
    }
    if (input.mediaType !== "image/png") {
      throw new Error("avatar portraits currently require image/png");
    }
    const displayName = avatarDisplayName(input.displayName);
    const size = input.displaySize ?? "standard";
    if (!(size in AVATAR_DISPLAY_SIZES)) throw new Error("unknown avatar display size");
    const dimensions = pngDimensions(input.bytes);
    const rights = normalizedRights(input.rights);
    const artifactPrefix = `avatar.${input.agentIdentityId}`;
    const image = await this.#store.put({
      organizationId: input.organizationId,
      artifactId: `${artifactPrefix}.image`,
      mediaType: input.mediaType,
      bytes: input.bytes,
      scan: input.scan,
    });
    const manifestBytes = Buffer.from(JSON.stringify({
      schemaVersion: 1,
      organizationId: input.organizationId,
      agentIdentityId: input.agentIdentityId,
      imageVersion: image.version,
      imageSha256: image.sha256,
      mediaType: input.mediaType,
      width: dimensions.width,
      height: dimensions.height,
      rights,
    }), "utf8");
    const rightsManifest = await this.#store.put({
      organizationId: input.organizationId,
      artifactId: `${artifactPrefix}.rights`,
      mediaType: "application/json",
      bytes: manifestBytes,
      scan: { required: false, status: "not-required" },
    });
    const fallback = avatarFallback(displayName, size);
    return Object.freeze({
      kind: "portrait",
      organizationId: input.organizationId,
      agentIdentityId: input.agentIdentityId,
      displayName,
      width: dimensions.width,
      height: dimensions.height,
      sizePixels: AVATAR_DISPLAY_SIZES[size],
      image,
      rightsManifest,
      fallback,
    });
  }
}

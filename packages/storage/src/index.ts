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
  readonly durableVersioning: boolean;
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
  if (requiresScan && (scan.required !== true || scan.status !== "clean")) {
    throw new Error(`${mediaType} requires clean malware-scan evidence before storage`);
  }
  if (scan.required === true) {
    if (scan.status !== "clean" || scan.scanner.trim() === "") {
      throw new Error("required scan evidence must identify a clean scanner result");
    }
    assertTimestamp(scan.scannedAt, "scan.scannedAt");
  } else if (scan.status !== "not-required") {
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
  const { immutableVersions, tenantScopedKeys, durableVersioning } = backend.capabilities;
  if (!immutableVersions || !tenantScopedKeys || !durableVersioning) {
    throw new Error("artifact backend must provide immutable, tenant-scoped durable versions");
  }
};

export class InMemoryArtifactBackend implements ArtifactObjectBackend {
  readonly capabilities = Object.freeze({
    immutableVersions: true,
    tenantScopedKeys: true,
    durableVersioning: true,
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

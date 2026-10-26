import type { ArtifactMetadata, ArtifactScanEvidence, EncryptedArtifactStore } from "./index.js";

export const AVATAR_MEDIA_TYPES = ["image/jpeg", "image/png"] as const;
export const DEFAULT_MAX_AVATAR_BYTES = 5 * 1024 * 1024;
export const DEFAULT_MIN_AVATAR_EDGE = 64;
export const DEFAULT_MAX_AVATAR_EDGE = 2048;

export type AvatarMediaType = (typeof AVATAR_MEDIA_TYPES)[number];

export type AvatarRightsEvidence =
  | { readonly kind: "original"; readonly creatorAffirmed: true }
  | {
      readonly kind: "user-licensed";
      readonly licenseReference: string;
      readonly userAffirmed: true;
    };

export interface PutAvatarRequest {
  readonly organizationId: string;
  readonly agentIdentityId: string;
  readonly displayName: string;
  readonly mediaType: AvatarMediaType;
  readonly bytes: Uint8Array;
  readonly scan: ArtifactScanEvidence;
  readonly rights: AvatarRightsEvidence;
}

export interface AvatarReceipt {
  readonly artifact: ArtifactMetadata;
  readonly width: number;
  readonly height: number;
  readonly rights: AvatarRightsEvidence;
}

export type AvatarPresentation =
  | {
      readonly kind: "image";
      readonly mediaType: AvatarMediaType;
      readonly bytes: Uint8Array;
      readonly width: number;
      readonly height: number;
      readonly altText: string;
    }
  | {
      readonly kind: "monogram";
      readonly text: string;
      readonly altText: string;
      readonly reason: "not-configured" | "unavailable";
    };

export interface AvatarPipelineOptions {
  readonly store: EncryptedArtifactStore;
  readonly maxBytes?: number;
  readonly minEdge?: number;
  readonly maxEdge?: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PNG_SIGNATURE = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
const JPEG_START_OF_FRAME = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

const boundedInteger = (value: number | undefined, fallback: number, label: string): number => {
  const result = value ?? fallback;
  if (!Number.isSafeInteger(result) || result < 1) throw new Error(`${label} must be a positive safe integer`);
  return result;
};

const displayNameOf = (value: string): string => {
  const displayName = value.trim();
  if (!displayName || displayName.length > 120) {
    throw new Error("displayName must contain 1 to 120 characters");
  }
  return displayName;
};

const readUint32 = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset] ?? 0) * 0x1000000) +
  ((bytes[offset + 1] ?? 0) << 16) +
  ((bytes[offset + 2] ?? 0) << 8) +
  (bytes[offset + 3] ?? 0);

const pngDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  if (bytes.byteLength < 45 || PNG_SIGNATURE.some((value, index) => bytes[index] !== value)) {
    throw new Error("avatar bytes are not a structurally valid PNG");
  }
  if (readUint32(bytes, 8) !== 13 || Buffer.from(bytes.subarray(12, 16)).toString("ascii") !== "IHDR") {
    throw new Error("avatar PNG must begin with an IHDR chunk");
  }
  let offset = 8;
  let hasEnd = false;
  while (offset + 12 <= bytes.byteLength) {
    const length = readUint32(bytes, offset);
    const next = offset + 12 + length;
    if (!Number.isSafeInteger(next) || next > bytes.byteLength) {
      throw new Error("avatar PNG contains a truncated chunk");
    }
    const type = Buffer.from(bytes.subarray(offset + 4, offset + 8)).toString("ascii");
    if (type === "IEND") {
      if (length !== 0 || next !== bytes.byteLength) throw new Error("avatar PNG has an invalid IEND chunk");
      hasEnd = true;
      break;
    }
    offset = next;
  }
  if (!hasEnd) throw new Error("avatar PNG is missing its IEND chunk");
  return { width: readUint32(bytes, 16), height: readUint32(bytes, 20) };
};

const jpegDimensions = (bytes: Uint8Array): { width: number; height: number } => {
  if (bytes.byteLength < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
      bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) {
    throw new Error("avatar bytes are not a structurally valid JPEG");
  }
  let offset = 2;
  while (offset + 4 <= bytes.byteLength - 2) {
    if (bytes[offset] !== 0xff) throw new Error("avatar JPEG contains an invalid marker");
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = ((bytes[offset] ?? 0) << 8) + (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.byteLength - 2) {
      throw new Error("avatar JPEG contains a truncated segment");
    }
    if (JPEG_START_OF_FRAME.has(marker)) {
      if (length < 7) throw new Error("avatar JPEG has an invalid frame header");
      return {
        height: ((bytes[offset + 3] ?? 0) << 8) + (bytes[offset + 4] ?? 0),
        width: ((bytes[offset + 5] ?? 0) << 8) + (bytes[offset + 6] ?? 0),
      };
    }
    offset += length;
  }
  throw new Error("avatar JPEG is missing a supported frame header");
};

const dimensionsOf = (mediaType: AvatarMediaType, bytes: Uint8Array) =>
  mediaType === "image/png" ? pngDimensions(bytes) : jpegDimensions(bytes);

const assertRights = (rights: AvatarRightsEvidence): AvatarRightsEvidence => {
  if (rights?.kind === "original" && rights.creatorAffirmed === true) return Object.freeze({ ...rights });
  if (rights?.kind === "user-licensed" && rights.userAffirmed === true) {
    const licenseReference = rights.licenseReference.trim();
    if (licenseReference && licenseReference.length <= 200) {
      return Object.freeze({ ...rights, licenseReference });
    }
  }
  throw new Error("avatar requires explicit original or user-licensed rights evidence");
};

export const monogramFor = (displayName: string): string => {
  const parts = displayNameOf(displayName).match(/[\p{L}\p{N}]+/gu) ?? [];
  if (parts.length === 0) return "?";
  const selected = parts.length === 1 ? parts : [parts[0], parts.at(-1) ?? ""];
  return selected.map((part) => [...part][0]?.toLocaleUpperCase() ?? "").join("");
};

const artifactIdFor = (agentIdentityId: string): string => {
  if (!UUID_PATTERN.test(agentIdentityId)) throw new Error("agentIdentityId must be a UUID");
  return `agent-avatar-${agentIdentityId.toLowerCase()}`;
};

export class AvatarPipeline {
  readonly #store: EncryptedArtifactStore;
  readonly #maxBytes: number;
  readonly #minEdge: number;
  readonly #maxEdge: number;

  constructor(options: AvatarPipelineOptions) {
    this.#store = options.store;
    this.#maxBytes = boundedInteger(options.maxBytes, DEFAULT_MAX_AVATAR_BYTES, "maxBytes");
    this.#minEdge = boundedInteger(options.minEdge, DEFAULT_MIN_AVATAR_EDGE, "minEdge");
    this.#maxEdge = boundedInteger(options.maxEdge, DEFAULT_MAX_AVATAR_EDGE, "maxEdge");
    if (this.#minEdge > this.#maxEdge) throw new Error("minEdge cannot exceed maxEdge");
  }

  async put(request: PutAvatarRequest): Promise<AvatarReceipt> {
    if (Object.hasOwn(request as object, "sourceUrl")) {
      throw new Error("remote avatar URLs are not accepted; upload cleared bytes directly");
    }
    displayNameOf(request.displayName);
    if (!AVATAR_MEDIA_TYPES.includes(request.mediaType)) throw new Error("avatar media type is unsupported");
    if (request.bytes.byteLength < 1 || request.bytes.byteLength > this.#maxBytes) {
      throw new Error(`avatar must contain 1 to ${this.#maxBytes} bytes`);
    }
    const rights = assertRights(request.rights);
    const dimensions = dimensionsOf(request.mediaType, request.bytes);
    if (
      dimensions.width < this.#minEdge || dimensions.height < this.#minEdge ||
      dimensions.width > this.#maxEdge || dimensions.height > this.#maxEdge
    ) {
      throw new Error(`avatar dimensions must be between ${this.#minEdge} and ${this.#maxEdge} pixels per edge`);
    }
    const artifact = await this.#store.put({
      organizationId: request.organizationId,
      artifactId: artifactIdFor(request.agentIdentityId),
      mediaType: request.mediaType,
      bytes: request.bytes,
      scan: request.scan,
    });
    return Object.freeze({ artifact, ...dimensions, rights });
  }

  async resolve(input: {
    organizationId: string;
    agentIdentityId: string;
    displayName: string;
    version?: number;
    mediaType?: AvatarMediaType;
  }): Promise<AvatarPresentation> {
    const displayName = displayNameOf(input.displayName);
    const fallback = (reason: "not-configured" | "unavailable"): AvatarPresentation => Object.freeze({
      kind: "monogram",
      text: monogramFor(displayName),
      altText: `${displayName} monogram`,
      reason,
    });
    if (input.version === undefined || input.mediaType === undefined) return fallback("not-configured");
    if (!Number.isSafeInteger(input.version) || input.version < 1 || !AVATAR_MEDIA_TYPES.includes(input.mediaType)) {
      return fallback("unavailable");
    }
    try {
      const bytes = await this.#store.get(
        input.organizationId,
        artifactIdFor(input.agentIdentityId),
        input.version,
      );
      if (bytes === undefined) return fallback("unavailable");
      const dimensions = dimensionsOf(input.mediaType, bytes);
      if (
        dimensions.width < this.#minEdge || dimensions.height < this.#minEdge ||
        dimensions.width > this.#maxEdge || dimensions.height > this.#maxEdge
      ) return fallback("unavailable");
      return Object.freeze({
        kind: "image",
        mediaType: input.mediaType,
        bytes,
        ...dimensions,
        altText: `${displayName} avatar`,
      });
    } catch {
      return fallback("unavailable");
    }
  }
}

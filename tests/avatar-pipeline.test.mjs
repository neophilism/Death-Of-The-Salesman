import assert from "node:assert/strict";
import test from "node:test";
import { AvatarPipeline, monogramFor } from "../packages/storage/dist/avatar-pipeline.js";

const uuid = "018f38a8-2ace-7d8a-9f53-73a61a74dd5e";
const png = (width, height) => {
  const bytes = Buffer.alloc(45);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes, 0);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes.writeUInt32BE(0, 33);
  bytes.write("IEND", 37, "ascii");
  bytes.writeUInt32BE(0, 41);
  return bytes;
};
const jpeg = (width, height) => Uint8Array.of(
  0xff, 0xd8,
  0xff, 0xc0, 0, 7, 8, height >> 8, height & 255, width >> 8, width & 255,
  0xff, 0xd9,
);

const records = new Map();
const fakeStore = {
  put: async ({ organizationId, artifactId, mediaType, bytes }) => {
    records.set(`${organizationId}/${artifactId}/1`, bytes);
    return {
      organizationId, artifactId, version: 1, objectKey: "test", mediaType,
      sizeBytes: bytes.byteLength, sha256: "0".repeat(64), createdAt: "2026-10-26T00:00:00.000Z",
      scan: { required: true, status: "clean", scanner: "fixture", scannedAt: "2026-10-26T00:00:00.000Z" },
    };
  },
  get: async (organizationId, artifactId, version) =>
    records.get(`${organizationId}/${artifactId}/${version}`),
};

test("stores original and licensed avatars only after structural and size validation", async () => {
  records.clear();
  const pipeline = new AvatarPipeline({ store: fakeStore });
  const original = await pipeline.put({
    organizationId: "org-one", agentIdentityId: uuid, displayName: "Fast Eddie Felson",
    mediaType: "image/png", bytes: png(256, 192),
    scan: { required: true, status: "clean", scanner: "fixture", scannedAt: "2026-10-26T00:00:00.000Z" },
    rights: { kind: "original", creatorAffirmed: true },
  });
  assert.deepEqual([original.width, original.height, original.artifact.version], [256, 192, 1]);
  const licensed = await pipeline.put({
    organizationId: "org-one", agentIdentityId: uuid, displayName: "Fast Eddie Felson",
    mediaType: "image/jpeg", bytes: jpeg(640, 480),
    scan: { required: true, status: "clean", scanner: "fixture", scannedAt: "2026-10-26T00:00:00.000Z" },
    rights: { kind: "user-licensed", userAffirmed: true, licenseReference: " license-record-7 " },
  });
  assert.equal(licensed.rights.kind === "user-licensed" && licensed.rights.licenseReference, "license-record-7");
});

test("rejects remote, unsupported, unlicensed, malformed, and out-of-range images", async () => {
  const pipeline = new AvatarPipeline({ store: fakeStore });
  const base = {
    organizationId: "org-one", agentIdentityId: uuid, displayName: "Harry Wormwood",
    mediaType: "image/png", bytes: png(256, 256),
    scan: { required: true, status: "clean", scanner: "fixture", scannedAt: "2026-10-26T00:00:00.000Z" },
    rights: { kind: "original", creatorAffirmed: true },
  };
  await assert.rejects(pipeline.put({ ...base, sourceUrl: "https://example.test/film-still.png" }), /remote avatar URLs/);
  await assert.rejects(pipeline.put({ ...base, mediaType: "image/webp" }), /unsupported/);
  await assert.rejects(pipeline.put({ ...base, rights: { kind: "original", creatorAffirmed: false } }), /rights evidence/);
  await assert.rejects(pipeline.put({ ...base, bytes: Uint8Array.of(1, 2, 3) }), /structurally valid PNG/);
  await assert.rejects(pipeline.put({ ...base, bytes: png(32, 256) }), /between 64 and 2048/);
  await assert.rejects(pipeline.put({ ...base, bytes: png(256, 4096) }), /between 64 and 2048/);
});

test("resolves images and uses deterministic accessible monograms for unavailable media", async () => {
  records.clear();
  const pipeline = new AvatarPipeline({ store: fakeStore });
  await pipeline.put({
    organizationId: "org-one", agentIdentityId: uuid, displayName: "Fast Eddie Felson",
    mediaType: "image/png", bytes: png(128, 128),
    scan: { required: true, status: "clean", scanner: "fixture", scannedAt: "2026-10-26T00:00:00.000Z" },
    rights: { kind: "original", creatorAffirmed: true },
  });
  const image = await pipeline.resolve({
    organizationId: "org-one", agentIdentityId: uuid, displayName: "Fast Eddie Felson",
    version: 1, mediaType: "image/png",
  });
  assert.equal(image.kind, "image");
  const unset = await pipeline.resolve({ organizationId: "org-one", agentIdentityId: uuid, displayName: "Harry Wormwood" });
  assert.deepEqual(unset, { kind: "monogram", text: "HW", altText: "Harry Wormwood monogram", reason: "not-configured" });
  const missing = await pipeline.resolve({
    organizationId: "org-one", agentIdentityId: uuid, displayName: "Harry Wormwood",
    version: 9, mediaType: "image/png",
  });
  assert.equal(missing.kind === "monogram" && missing.reason, "unavailable");
  assert.equal(monogramFor('"Fast Eddie" Felson'), "FF");
});

test("storage read failures never break the roster fallback", async () => {
  const pipeline = new AvatarPipeline({
    store: { ...fakeStore, get: async () => { throw new Error("object store unavailable"); } },
  });
  const result = await pipeline.resolve({
    organizationId: "org-one", agentIdentityId: uuid, displayName: "Fast Eddie Felson",
    version: 1, mediaType: "image/png",
  });
  assert.deepEqual(result, { kind: "monogram", text: "FF", altText: "Fast Eddie Felson monogram", reason: "unavailable" });
});

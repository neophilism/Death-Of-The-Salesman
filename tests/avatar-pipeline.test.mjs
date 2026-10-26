
import assert from "node:assert/strict";
import test from "node:test";
import {
  AvatarPipeline,
  EncryptedArtifactStore,
  InMemoryArtifactBackend,
  createAvatarFallback,
  presentAvatar,
} from "../packages/storage/dist/index.js";

const png = (width, height) => {
  const bytes = Buffer.alloc(45);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  bytes.writeUInt32BE(0, 33);
  bytes.write("IEND", 37, "ascii");
  bytes.writeUInt32BE(0, 41);
  return bytes;
};

const createPipeline = () => {
  const backend = new InMemoryArtifactBackend();
  const store = new EncryptedArtifactStore({
    backend,
    encryptionKey: new Uint8Array(32).fill(21),
    keyId: "avatar-test-key",
    now: () => new Date("2026-10-26T08:00:00.000Z"),
  });
  return { backend, store, pipeline: new AvatarPipeline(store) };
};

const cleanScan = {
  required: true,
  status: "clean",
  scanner: "fixture-scanner",
  scannedAt: "2026-10-26T07:59:00.000Z",
};

test("monograms are deterministic, sized, and accessible without an image", () => {
  assert.deepEqual(createAvatarFallback(" Fast   Eddie Felson ", "compact"), {
    kind: "monogram",
    monogram: "FF",
    accessibleName: "Fast Eddie Felson avatar",
    sizePixels: 40,
  });
  assert.equal(presentAvatar(undefined, false).kind, "monogram");
});

test("original portraits store encrypted image and durable rights evidence", async () => {
  const { store, pipeline } = createPipeline();
  const portrait = await pipeline.storePortrait({
    organizationId: "org-private-demo",
    agentIdentityId: "agent-fast-eddie",
    displayName: "Fast Eddie Felson",
    mediaType: "image/png",
    bytes: png(512, 640),
    scan: cleanScan,
    rights: {
      kind: "original",
      creator: "Owner commissioned artwork",
      attestedByMembershipId: "membership-owner",
    },
    displaySize: "profile",
  });

  assert.equal(portrait.width, 512);
  assert.equal(portrait.height, 640);
  assert.equal(portrait.sizePixels, 96);
  assert.equal(portrait.fallback.monogram, "FF");
  assert.equal(presentAvatar(portrait, true).kind, "image");
  assert.equal(presentAvatar(portrait, false).kind, "monogram");

  const manifest = JSON.parse(Buffer.from(await store.get(
    "org-private-demo",
    portrait.rightsManifest.artifactId,
    portrait.rightsManifest.version,
  )).toString("utf8"));
  assert.equal(manifest.rights.kind, "original");
  assert.equal(manifest.imageSha256, portrait.image.sha256);
  assert.equal(manifest.width, 512);
});

test("licensed uploads require bounded evidence and clean scanning", async () => {
  const { pipeline } = createPipeline();
  await assert.rejects(pipeline.storePortrait({
    organizationId: "org-one",
    agentIdentityId: "agent-one",
    displayName: "Licensed Agent",
    mediaType: "image/png",
    bytes: png(256, 256),
    scan: { required: false, status: "not-required" },
    rights: {
      kind: "user-licensed",
      licenseReference: "customer asset record 42",
      attestedByMembershipId: "membership-owner",
    },
  }), /requires clean malware-scan evidence/);

  await assert.rejects(pipeline.storePortrait({
    organizationId: "org-one",
    agentIdentityId: "agent-one",
    displayName: "Unlicensed Agent",
    mediaType: "image/png",
    bytes: png(256, 256),
    scan: cleanScan,
    rights: {
      kind: "actor-still",
      attestedByMembershipId: "membership-owner",
    },
  }), /original or user-licensed/);
});

test("malformed and oversized portrait headers fail before storage", async () => {
  const { backend, pipeline } = createPipeline();
  const request = {
    organizationId: "org-one",
    agentIdentityId: "agent-one",
    displayName: "Agent One",
    mediaType: "image/png",
    scan: cleanScan,
    rights: {
      kind: "original",
      creator: "Owner",
      attestedByMembershipId: "membership-owner",
    },
  };

  await assert.rejects(
    pipeline.storePortrait({ ...request, bytes: Buffer.from("not an image") }),
    /structurally valid PNG/,
  );
  const headerOnly = png(256, 256).subarray(0, 24);
  await assert.rejects(
    pipeline.storePortrait({ ...request, bytes: headerOnly }),
    /structurally valid PNG/,
  );
  await assert.rejects(
    pipeline.storePortrait({ ...request, bytes: png(4096, 4096) }),
    /between 32 and 2048 pixels/,
  );
  await assert.rejects(
    pipeline.storePortrait({
      ...request,
      bytes: png(256, 256),
      sourceUrl: "https://example.test/actor-still.png",
    }),
    /remote avatar URLs are not accepted/,
  );
  assert.deepEqual(await backend.listVersions("org-one", "avatar.agent-one.image"), []);
});

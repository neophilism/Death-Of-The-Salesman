import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_AVATAR_MAX_BYTES,
  EncryptedArtifactStore,
  InMemoryArtifactBackend,
  agentAvatarMonogram,
  putAgentAvatar,
} from "../packages/storage/dist/index.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const agentIdentityId = "22222222-2222-4222-8222-222222222222";
const ownerMembershipId = "33333333-3333-4333-8333-333333333333";
const now = () => new Date("2026-10-26T08:00:00.000Z");
const cleanScan = {
  required: true,
  status: "clean",
  scanner: "fixture-scanner",
  scannedAt: "2026-10-26T07:59:00.000Z",
};
const originalRights = {
  sourceKind: "original",
  attestedByMembershipId: ownerMembershipId,
  attestedAt: "2026-10-26T07:58:00.000Z",
  depictsActorOrFilmStill: false,
};
const createStore = () => {
  const backend = new InMemoryArtifactBackend();
  return {
    backend,
    store: new EncryptedArtifactStore({
      backend,
      encryptionKey: new Uint8Array(32).fill(21),
      keyId: "avatar-test-key",
      now,
    }),
  };
};

test("stores a rights-attested original avatar as an encrypted immutable image", async () => {
  const { backend, store } = createStore();
  const bytes = Buffer.from("synthetic-png-fixture");
  const receipt = await putAgentAvatar(store, {
    organizationId,
    agentIdentityId,
    displayName: '"Fast Eddie" Felson',
    mediaType: "image/png",
    widthPixels: 512,
    heightPixels: 512,
    bytes,
    scan: cleanScan,
    rights: originalRights,
  });

  assert.equal(receipt.artifact.objectKey, `tenants/${organizationId}/artifacts/avatar-${agentIdentityId}/v1`);
  assert.equal(receipt.fallbackMonogram, "FF");
  assert.match(receipt.rightsAttestationSha256, /^[0-9a-f]{64}$/);
  const raw = await backend.getVersion(organizationId, `avatar-${agentIdentityId}`, 1);
  assert.ok(raw);
  assert.equal(Buffer.from(raw.ciphertext).includes(bytes), false);
  assert.deepEqual(Buffer.from(await store.get(organizationId, `avatar-${agentIdentityId}`, 1)), bytes);
});

test("licensed images require a bounded license reference", async () => {
  const { store } = createStore();
  await assert.rejects(putAgentAvatar(store, {
    organizationId,
    agentIdentityId,
    displayName: "Harry Wormwood",
    mediaType: "image/webp",
    widthPixels: 256,
    heightPixels: 256,
    bytes: Buffer.from("webp"),
    scan: cleanScan,
    rights: { ...originalRights, sourceKind: "licensed" },
  }), /license reference/);
});

test("rejects actor or film-still sources, unsafe formats, sizing, scans, and byte bounds", async () => {
  const base = {
    organizationId,
    agentIdentityId,
    displayName: "Harry Wormwood",
    mediaType: "image/jpeg",
    widthPixels: 256,
    heightPixels: 256,
    bytes: Buffer.from("jpeg"),
    scan: cleanScan,
    rights: originalRights,
  };
  for (const [change, message] of [
    [{ rights: { ...originalRights, depictsActorOrFilmStill: true } }, /actor likenesses and film stills/],
    [{ mediaType: "image/svg+xml" }, /JPEG, PNG, or WebP/],
    [{ widthPixels: 640, heightPixels: 480 }, /square images/],
    [{ scan: { required: false, status: "not-required" } }, /requires clean malware-scan evidence/],
    [{ bytes: new Uint8Array(AGENT_AVATAR_MAX_BYTES + 1) }, /must contain/],
  ]) {
    await assert.rejects(putAgentAvatar(createStore().store, { ...base, ...change }), message);
  }
});

test("monograms are deterministic and remain available when an image is inaccessible", () => {
  assert.equal(agentAvatarMonogram("Harry Wormwood"), "HW");
  assert.equal(agentAvatarMonogram("  Blake  "), "B");
  assert.equal(agentAvatarMonogram(""), "?");
});

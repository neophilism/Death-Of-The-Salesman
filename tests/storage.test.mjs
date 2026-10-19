import assert from "node:assert/strict";
import test from "node:test";
import {
  EncryptedArtifactStore,
  InMemoryArtifactBackend,
} from "../packages/storage/dist/index.js";

const key = new Uint8Array(32).fill(7);
const now = () => new Date("2026-10-19T01:15:00.000Z");
const createStore = (backend = new InMemoryArtifactBackend(), options = {}) => ({
  backend,
  store: new EncryptedArtifactStore({
    backend,
    encryptionKey: key,
    keyId: "test-key-v1",
    now,
    ...options,
  }),
});

test("artifacts are encrypted, immutable, and independently versioned", async () => {
  const { backend, store } = createStore();
  const first = await store.put({
    organizationId: "org-one",
    artifactId: "proposal",
    mediaType: "text/plain",
    bytes: Buffer.from("first private draft"),
    scan: { required: false, status: "not-required" },
  });
  const second = await store.put({
    organizationId: "org-one",
    artifactId: "proposal",
    mediaType: "text/plain",
    bytes: Buffer.from("second private draft"),
    scan: { required: false, status: "not-required" },
  });

  assert.equal(first.version, 1);
  assert.equal(second.version, 2);
  assert.match(first.sha256, /^[0-9a-f]{64}$/);
  assert.equal(first.createdAt, "2026-10-19T01:15:00.000Z");
  assert.equal(
    Buffer.from(await store.get("org-one", "proposal", 1)).toString(),
    "first private draft",
  );
  assert.equal(
    Buffer.from(await store.get("org-one", "proposal", 2)).toString(),
    "second private draft",
  );

  const raw = await backend.getVersion("org-one", "proposal", 1);
  assert.ok(raw);
  assert.equal(Buffer.from(raw.ciphertext).includes(Buffer.from("first private draft")), false);
  await assert.rejects(backend.putVersion(raw), /already exists/);
});

test("tenant and object boundaries fail closed even for a faulty backend", async () => {
  const { backend, store } = createStore();
  await store.put({
    organizationId: "org-one",
    artifactId: "evidence",
    mediaType: "application/json",
    bytes: Buffer.from("{}"),
    scan: { required: false, status: "not-required" },
  });
  assert.equal(await store.get("org-two", "evidence", 1), undefined);

  const record = await backend.getVersion("org-one", "evidence", 1);
  assert.ok(record);
  const faultyBackend = {
    capabilities: backend.capabilities,
    listVersions: async () => [1],
    putVersion: async () => {},
    getVersion: async () => record,
  };
  const faultyStore = createStore(faultyBackend).store;
  await assert.rejects(
    faultyStore.get("org-two", "evidence", 1),
    /crossed a tenant or object boundary/,
  );
});

test("size, scan, backend, key, and identifier requirements are enforced", async () => {
  const { store } = createStore(undefined, { maxArtifactBytes: 4 });
  await assert.rejects(
    store.put({
      organizationId: "org-one",
      artifactId: "large",
      mediaType: "text/plain",
      bytes: Buffer.from("12345"),
      scan: { required: false, status: "not-required" },
    }),
    /4-byte limit/,
  );
  await assert.rejects(
    store.put({
      organizationId: "org-one",
      artifactId: "attachment",
      mediaType: "application/pdf",
      bytes: Buffer.from("%PDF"),
      scan: { required: false, status: "not-required" },
    }),
    /requires clean malware-scan evidence/,
  );
  await assert.rejects(
    store.put({
      organizationId: "org-one",
      artifactId: "bad-scan",
      mediaType: "application/pdf",
      bytes: Buffer.from("%PDF"),
      scan: { required: true, status: "clean" },
    }),
    /must identify a clean scanner result/,
  );
  await assert.rejects(
    store.put({
      organizationId: "../foreign",
      artifactId: "attachment",
      mediaType: "text/plain",
      bytes: Buffer.from("ok"),
      scan: { required: false, status: "not-required" },
    }),
    /bounded storage identifier/,
  );
  assert.throws(
    () => createStore({
      capabilities: {
        immutableVersions: true,
        tenantScopedKeys: false,
        versionedObjects: true,
      },
    }),
    /immutable, tenant-scoped versioned objects/,
  );
  assert.throws(
    () => new EncryptedArtifactStore({
      backend: new InMemoryArtifactBackend(),
      encryptionKey: new Uint8Array(31),
      keyId: "test-key-v1",
    }),
    /exactly 32 bytes/,
  );
});

test("clean scan evidence permits attachments and tampering is detected", async () => {
  const { backend, store } = createStore();
  await store.put({
    organizationId: "org-one",
    artifactId: "attachment",
    mediaType: "application/pdf",
    bytes: Buffer.from("%PDF synthetic"),
    scan: {
      required: true,
      status: "clean",
      scanner: "fixture-scanner",
      scannedAt: "2026-10-19T01:14:00.000Z",
    },
  });
  const record = await backend.getVersion("org-one", "attachment", 1);
  assert.ok(record);
  const tampered = {
    ...record,
    ciphertext: Uint8Array.from(record.ciphertext, (value, index) =>
      index === 0 ? value ^ 1 : value),
  };
  const tamperingBackend = {
    capabilities: backend.capabilities,
    listVersions: async () => [1],
    putVersion: async () => {},
    getVersion: async () => tampered,
  };
  await assert.rejects(
    createStore(tamperingBackend).store.get("org-one", "attachment", 1),
    /authentication failed/,
  );
});

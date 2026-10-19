import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  CONTRACT_KINDS,
  CONTRACT_SCHEMA_VERSION,
  parseContract,
  serializeContract,
} from "../packages/domain/dist/index.js";

const fixtures = {
  project: { id: "project-1", organizationId: "org-1", name: "Launch", status: "active" },
  agent: { id: "agent-1", organizationId: "org-1", name: "Fast Eddie Felson", status: "inactive" },
  campaign: { id: "campaign-1", projectId: "project-1", name: "Synthetic preview", status: "draft" },
  contact: { id: "contact-1", organizationId: "org-1", displayName: "Synthetic contact", status: "suppressed" },
  workItem: { id: "work-1", projectId: "project-1", assigneeAgentId: null, status: "queued" },
  event: { id: "event-1", organizationId: "org-1", type: "project.created", occurredAt: "2026-10-19T00:00:00Z" },
  approval: { id: "approval-1", organizationId: "org-1", action: "send.test", status: "pending" },
  usage: { id: "usage-1", organizationId: "org-1", unit: "request", quantity: 0 },
  error: { code: "CONTRACT_INVALID", message: "Synthetic validation error", retryable: false },
};

test("all canonical contract fixtures round-trip without losing information", () => {
  assert.deepEqual(Object.keys(fixtures), [...CONTRACT_KINDS]);
  for (const kind of CONTRACT_KINDS) {
    const envelope = { schemaVersion: CONTRACT_SCHEMA_VERSION, kind, data: fixtures[kind] };
    assert.deepEqual(JSON.parse(serializeContract(envelope)), envelope);
  }
});

test("contracts reject inconsistent versions, unknown fields, and malformed values", () => {
  const project = { schemaVersion: CONTRACT_SCHEMA_VERSION, kind: "project", data: fixtures.project };
  assert.throws(() => parseContract({ ...project, schemaVersion: "2026-10-02" }), /schemaVersion/);
  assert.throws(() => parseContract({ ...project, data: { ...project.data, extra: true } }), /exactly/);
  assert.throws(() => parseContract({ ...project, data: { ...project.data, name: "" } }), /non-empty/);
  assert.throws(
    () => parseContract({ schemaVersion: CONTRACT_SCHEMA_VERSION, kind: "usage", data: { ...fixtures.usage, quantity: 0.5 } }),
    /safe integer/,
  );
  assert.throws(
    () =>
      parseContract({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind: "event",
        data: { ...fixtures.event, occurredAt: "2026-02-31T00:00:00Z" },
      }),
    /real ISO 8601/,
  );
});

test("OpenAPI components cover exactly the canonical kinds and version", async () => {
  const source = await readFile(new URL("../openapi/openapi.json", import.meta.url), "utf8");
  const document = JSON.parse(source);
  assert.equal(document.openapi, "3.1.1");
  assert.equal(document.info.version, CONTRACT_SCHEMA_VERSION);
  assert.deepEqual(Object.keys(document.components.schemas), [...CONTRACT_KINDS]);
  for (const schema of Object.values(document.components.schemas)) {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.properties.schemaVersion.const, CONTRACT_SCHEMA_VERSION);
  }
});


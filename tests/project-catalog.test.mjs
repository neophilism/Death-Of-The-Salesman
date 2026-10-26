import assert from "node:assert/strict";
import test from "node:test";
import {
  CatalogWriteError,
  ProjectCatalogRepository,
} from "../packages/database/dist/project-catalog.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const ownerMembershipId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const row = (overrides = {}) => ({
  id: "99999999-9999-4999-8999-999999999999",
  organization_id: organizationId,
  project_id: null,
  offer_id: null,
  label: "Launch",
  content: { summary: "Synthetic" },
  status: "active",
  version: 1,
  updated_at: "2026-10-26T00:00:00.000Z",
  ...overrides,
});

test("creates and reloads tenant-bound records in separate transactions", async () => {
  const statements = [];
  const responses = [{}, {}, { rows: [row()] }, {}, {}, {}, { rows: [row()] }, {}];
  const client = {
    query: async (statement, values) => {
      statements.push({ statement, values });
      return responses.shift() ?? {};
    },
  };
  const repository = new ProjectCatalogRepository(client);
  const created = await repository.create({
    kind: "project",
    organizationId,
    ownerMembershipId,
    label: " Launch ",
    content: { summary: "Synthetic" },
  });
  const reloaded = await repository.get({ kind: "project", organizationId, id: created.id });
  assert.equal(created.label, "Launch");
  assert.equal(reloaded?.version, 1);
  assert.equal(statements.filter(({ statement }) => statement === "BEGIN").length, 2);
  assert.ok(statements.some(({ statement, values }) =>
    statement.includes("set_config('app.organization_id'") && values[0] === organizationId));
  assert.ok(statements.some(({ statement }) =>
    statement.includes("memberships.role = 'owner'") && statement.includes("memberships.status = 'active'")));
});

test("updates and archives only an exact active version", async () => {
  const responses = [
    {}, {}, { rows: [row({ version: 2, label: "Launch v2" })] }, {},
    {}, {}, { rows: [row({ version: 3, label: "Launch v2", status: "archived" })] }, {},
  ];
  const client = { query: async () => responses.shift() ?? {} };
  const repository = new ProjectCatalogRepository(client);
  const updated = await repository.update({
    kind: "project", organizationId, ownerMembershipId,
    id: row().id, expectedVersion: 1, label: "Launch v2", content: {},
  });
  const archived = await repository.archive({
    kind: "project", organizationId, ownerMembershipId,
    id: row().id, expectedVersion: updated.version,
  });
  assert.equal(updated.version, 2);
  assert.equal(archived.status, "archived");
  assert.equal(archived.version, 3);
});

test("rejects stale writes, missing owners, and invalid parent shapes", async () => {
  const client = { query: async () => ({ rows: [] }) };
  const repository = new ProjectCatalogRepository(client);
  await assert.rejects(
    repository.update({
      kind: "offer", organizationId, ownerMembershipId,
      id: row().id, expectedVersion: 3, label: "Offer", content: {},
    }),
    (error) => error instanceof CatalogWriteError && error.code === "NOT_FOUND_OR_STALE",
  );
  await assert.rejects(
    repository.create({
      kind: "offer", organizationId, ownerMembershipId,
      label: "Offer", content: {},
    }),
    (error) => error instanceof CatalogWriteError && error.code === "INVALID_PARENT",
  );
});

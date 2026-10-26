import assert from "node:assert/strict";
import test from "node:test";
import { AgentIdentityRepository, AgentIdentityWriteError } from "../packages/database/dist/agent-identities.js";

const organizationId = "11111111-1111-4111-8111-111111111111";
const ownerMembershipId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const approvedNames = Array.from({ length: 264 }, (_, index) => `Approved ${index + 1}`);
approvedNames[58] = "Harry Wormwood";
approvedNames[97] = '"Fast Eddie" Felson';

const row = (overrides = {}) => ({
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  organization_id: organizationId,
  approved_name_id: 98,
  approved_name: '"Fast Eddie" Felson',
  display_name: "Fast Eddie Felson",
  status: "inactive",
  version: 1,
  updated_at: "2026-10-26T00:00:00.000Z",
  ...overrides,
});

test("requires the exact complete approved-name catalog", () => {
  assert.throws(() => new AgentIdentityRepository({ query: async () => ({}) }, approvedNames.slice(0, 263)));
  assert.throws(() => new AgentIdentityRepository({ query: async () => ({}) }, [...approvedNames.slice(0, 263), approvedNames[0]]));
});

test("creates only approved identities for an active same-tenant owner", async () => {
  const statements = [];
  const responses = [{}, {}, { rows: [row()] }, {}];
  const repository = new AgentIdentityRepository({ query: async (statement) => {
    statements.push(statement);
    return responses.shift() ?? {};
  } }, approvedNames);
  const identity = await repository.create({
    organizationId, ownerMembershipId, approvedName: '"Fast Eddie" Felson',
  });
  assert.equal(identity.approvedNameId, 98);
  assert.equal(identity.displayName, "Fast Eddie Felson");
  assert.ok(statements.some((statement) => statement.includes("memberships.role = 'owner'")));
  await assert.rejects(
    repository.create({ organizationId, ownerMembershipId, approvedName: "Not Approved" }),
    (error) => error instanceof AgentIdentityWriteError && error.code === "NAME_NOT_APPROVED",
  );
});

test("commercial tenants remain empty without explicit private-demo seeding", async () => {
  let queries = 0;
  const repository = new AgentIdentityRepository({ query: async () => { queries += 1; return {}; } }, approvedNames);
  assert.deepEqual(await repository.seedPrivateDemo({ organizationId, ownerMembershipId, privateDemo: false }), []);
  assert.equal(queries, 0);
});

test("private-demo seeding is explicit, idempotent, and limited to the first two identities", async () => {
  const values = [];
  const statements = [];
  const responses = [
    {}, {}, {},
    { rows: [row(), row({
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      approved_name_id: 59,
      approved_name: "Harry Wormwood",
      display_name: "Harry Wormwood",
    })] },
    {},
  ];
  const repository = new AgentIdentityRepository({ query: async (statement, parameters = []) => {
    statements.push(statement);
    values.push([...parameters]);
    return responses.shift() ?? {};
  } }, approvedNames);
  const identities = await repository.seedPrivateDemo({ organizationId, ownerMembershipId, privateDemo: true });
  assert.deepEqual(identities.map(({ displayName }) => displayName), ["Fast Eddie Felson", "Harry Wormwood"]);
  assert.deepEqual(values.find((parameters) => Array.isArray(parameters[3]))?.[3], [98, 59]);
  assert.deepEqual(values.find((parameters) => Array.isArray(parameters[4]))?.[4], ['"Fast Eddie" Felson', "Harry Wormwood"]);
  const readback = statements.find((statement) => statement.includes("ORDER BY array_position"));
  assert.match(readback ?? "", /memberships\.id = \$3/);
  assert.match(readback ?? "", /memberships\.role = 'owner'/);
});

test("updates require an exact live version and stale writes fail closed", async () => {
  const responses = [{}, {}, { rows: [row({ display_name: "Eddie", status: "active", version: 2 })] }, {}];
  const repository = new AgentIdentityRepository({ query: async () => responses.shift() ?? {} }, approvedNames);
  const updated = await repository.update({
    organizationId, ownerMembershipId, id: row().id,
    expectedVersion: 1, displayName: "Eddie", status: "active",
  });
  assert.equal(updated.version, 2);
  assert.equal(updated.status, "active");

  const staleResponses = [{}, {}, { rows: [] }, {}];
  const stale = new AgentIdentityRepository({ query: async () => staleResponses.shift() ?? {} }, approvedNames);
  await assert.rejects(
    stale.update({
      organizationId, ownerMembershipId, id: row().id,
      expectedVersion: 1, displayName: "Stale", status: "inactive",
    }),
    (error) => error instanceof AgentIdentityWriteError && error.code === "NOT_FOUND_OR_STALE",
  );
});

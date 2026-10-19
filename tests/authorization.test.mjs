import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthorizationError,
  authorize,
  authorizeEndpoint,
} from "../packages/authorization/dist/index.js";

const now = new Date("2026-10-19T01:00:00.000Z");
const human = (role, overrides = {}) => ({
  kind: "human",
  organizationId: "org-1",
  userId: role + "-user",
  membershipId: role + "-membership",
  role,
  membershipStatus: "active",
  ...overrides,
});
const agent = (overrides = {}) => ({
  kind: "agent",
  organizationId: "org-1",
  subject: "agent-17",
  grantId: "grant-1",
  scopes: ["projects:read", "contacts:read", "work:execute", "proposals:create"],
  resources: {
    projectIds: ["project-1"],
    campaignIds: ["campaign-1"],
    contactIds: ["contact-1"],
  },
  expiresAt: new Date("2026-10-19T02:00:00.000Z"),
  ...overrides,
});
const denied = (code) => (error) => error instanceof AuthorizationError && error.code === code;

test("owner retains explicit owner-only authority", () => {
  assert.equal(
    authorizeEndpoint({
      principal: human("owner"),
      organizationId: "org-1",
      method: "POST",
      path: "/api/v1/organization/transfer",
      now,
    }).scope,
    "organization:transfer",
  );
  assert.equal(
    authorizeEndpoint({
      principal: human("owner"),
      organizationId: "org-1",
      method: "POST",
      path: "/api/v1/owner-actions/action-1/resolve",
      now,
    }).scope,
    "approvals:resolve",
  );
});

test("admin cannot inherit owner transfer, membership, or approval authority", () => {
  for (const scope of ["organization:transfer", "memberships:manage", "approvals:resolve"]) {
    assert.throws(
      () => authorize({ principal: human("admin"), organizationId: "org-1", scope, now }),
      denied("UNAUTHORIZED"),
    );
  }
  assert.equal(
    authorize({
      principal: human("admin"),
      organizationId: "org-1",
      scope: "settings:write",
      now,
    }).scope,
    "settings:write",
  );
});

test("sales manager is limited to sales operations and delegation", () => {
  assert.equal(
    authorize({
      principal: human("sales_manager"),
      organizationId: "org-1",
      scope: "agents:delegate",
      now,
    }).scope,
    "agents:delegate",
  );
  for (const scope of ["settings:write", "audit:read", "approvals:resolve"]) {
    assert.throws(
      () => authorize({ principal: human("sales_manager"), organizationId: "org-1", scope, now }),
      denied("UNAUTHORIZED"),
    );
  }
});

test("inactive humans and every cross-tenant request fail closed", () => {
  assert.throws(
    () =>
      authorize({
        principal: human("owner", { membershipStatus: "inactive" }),
        organizationId: "org-1",
        scope: "projects:read",
        now,
      }),
    denied("UNAUTHORIZED"),
  );
  for (const principal of [human("owner"), human("admin"), human("sales_manager"), agent()]) {
    assert.throws(
      () => authorize({ principal, organizationId: "org-2", scope: "projects:read", now }),
      denied("CROSS_TENANT"),
    );
  }
});

test("agent can act only within both delegated scope and resource filters", () => {
  const decision = authorizeEndpoint({
    principal: agent(),
    organizationId: "org-1",
    method: "GET",
    path: "/api/v1/contacts/contact-1",
    resource: { contactId: "contact-1" },
    now,
  });
  assert.deepEqual(decision.resources.contactIds, ["contact-1"]);

  assert.throws(
    () =>
      authorizeEndpoint({
        principal: agent(),
        organizationId: "org-1",
        method: "GET",
        path: "/api/v1/contacts/contact-2",
        resource: { contactId: "contact-2" },
        now,
      }),
    denied("RESOURCE_DENIED"),
  );
  assert.throws(
    () =>
      authorizeEndpoint({
        principal: agent(),
        organizationId: "org-1",
        method: "GET",
        path: "/api/v1/contacts",
        now,
      }),
    denied("RESOURCE_DENIED"),
  );
});

test("agent never receives owner, admin, write, or delegation scopes", () => {
  for (const scope of [
    "organization:transfer",
    "memberships:manage",
    "settings:write",
    "projects:write",
    "contacts:write",
    "agents:delegate",
    "approvals:resolve",
    "audit:read",
  ]) {
    assert.throws(
      () =>
        authorize({
          principal: agent(),
          organizationId: "org-1",
          scope,
          resource: { projectId: "project-1" },
          now,
        }),
      denied("UNAUTHORIZED"),
    );
  }
});

test("malformed agent grants cannot smuggle an owner-only scope", () => {
  const malformed = agent({ scopes: ["projects:read", "organization:transfer"] });
  assert.throws(
    () =>
      authorize({
        principal: malformed,
        organizationId: "org-1",
        scope: "organization:transfer",
        resource: { projectId: "project-1" },
        now,
      }),
    denied("UNAUTHORIZED"),
  );
});

test("expired and revoked delegations fail before resource evaluation", () => {
  assert.throws(
    () =>
      authorize({
        principal: agent({ expiresAt: now }),
        organizationId: "org-1",
        scope: "projects:read",
        resource: { projectId: "project-1" },
        now,
      }),
    denied("EXPIRED_DELEGATION"),
  );
  assert.throws(
    () =>
      authorize({
        principal: agent({ revokedAt: new Date("2026-10-19T00:59:00.000Z") }),
        organizationId: "org-1",
        scope: "projects:read",
        resource: { projectId: "project-1" },
        now,
      }),
    denied("EXPIRED_DELEGATION"),
  );
});

test("unregistered endpoint and method combinations are denied", () => {
  assert.throws(
    () =>
      authorizeEndpoint({
        principal: human("owner"),
        organizationId: "org-1",
        method: "DELETE",
        path: "/api/v1/projects/project-1",
        now,
      }),
    denied("UNKNOWN_ENDPOINT"),
  );
});

test("runtime agent principals cannot forge an owner-only scope", () => {
  assert.throws(
    () =>
      authorize({
        principal: agent({ scopes: ["organization:transfer"] }),
        organizationId: "org-1",
        scope: "organization:transfer",
        resource: { projectId: "project-1" },
        now,
      }),
    denied("UNAUTHORIZED"),
  );
});

test("endpoint path IDs must match the authorized resource selector", () => {
  assert.throws(
    () =>
      authorizeEndpoint({
        principal: agent(),
        organizationId: "org-1",
        method: "GET",
        path: "/api/v1/contacts/contact-2",
        resource: { contactId: "contact-1" },
        now,
      }),
    denied("RESOURCE_DENIED"),
  );
});

test("agent selectors must match the requested scope type", () => {
  assert.throws(
    () =>
      authorize({
        principal: agent(),
        organizationId: "org-1",
        scope: "projects:read",
        resource: { contactId: "contact-1" },
        now,
      }),
    denied("RESOURCE_DENIED"),
  );
});

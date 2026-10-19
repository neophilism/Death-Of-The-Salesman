import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthenticationError,
  authorizeOwnerRequest,
  startOwnerSession,
} from "../packages/auth/dist/index.js";

const now = new Date("2026-10-19T00:00:00.000Z");

class MemorySessions {
  records = new Map();

  async create(record) {
    this.records.set(record.tokenHash, record);
  }

  async findByTokenHash(tokenHash) {
    return this.records.get(tokenHash);
  }

  async touch(id, lastSeenAt, idleExpiresAt) {
    const record = [...this.records.values()].find((candidate) => candidate.id === id);
    if (record) Object.assign(record, { lastSeenAt, idleExpiresAt });
  }
}

const directory = {
  findUserId: async (issuer, subject) =>
    issuer === "https://identity.example" && subject === "owner-1" ? "user-1" : undefined,
  findActiveMembership: async (userId, organizationId) =>
    userId === "user-1" && organizationId === "org-1"
      ? { id: "membership-1", organizationId, userId, role: "owner" }
      : undefined,
};

const login = async (sessions, claims = {}) =>
  startOwnerSession({
    idToken: "provider-signed-token",
    organizationId: "org-1",
    verifier: {
      verifyIdToken: async () => ({
        issuer: "https://identity.example",
        subject: "owner-1",
        authenticatedAt: now,
        ...claims,
      }),
    },
    directory,
    sessions,
    now,
    absoluteTtlSeconds: 3600,
    idleTtlSeconds: 600,
  });

test("verified OIDC identity creates an opaque, organization-bound session", async () => {
  const sessions = new MemorySessions();
  const credentials = await login(sessions);
  assert.match(credentials.sessionToken, /^[A-Za-z0-9_-]{43}$/);
  assert.match(credentials.csrfToken, /^[A-Za-z0-9_-]{43}$/);
  const [record] = sessions.records.values();
  assert.equal(record.organizationId, "org-1");
  assert.equal(record.userId, "user-1");
  assert.equal(record.tokenHash.includes(credentials.sessionToken), false);
});

test("unknown OIDC identities fail without creating a session", async () => {
  const sessions = new MemorySessions();
  await assert.rejects(
    login(sessions, { subject: "unknown" }),
    (error) => error instanceof AuthenticationError && error.code === "UNAUTHENTICATED",
  );
  assert.equal(sessions.records.size, 0);
});

test("anonymous and expired owner requests are denied", async () => {
  const sessions = new MemorySessions();
  await assert.rejects(
    authorizeOwnerRequest({ method: "GET", sessions, now }),
    (error) => error instanceof AuthenticationError && error.status === 401,
  );
  const credentials = await login(sessions);
  await assert.rejects(
    authorizeOwnerRequest({
      method: "GET",
      sessions,
      sessionToken: credentials.sessionToken,
      now: new Date("2026-10-19T01:00:00.000Z"),
    }),
    (error) => error instanceof AuthenticationError && error.code === "UNAUTHENTICATED",
  );
});

test("unsafe requests require the independent CSRF token", async () => {
  const sessions = new MemorySessions();
  const credentials = await login(sessions);
  await assert.rejects(
    authorizeOwnerRequest({
      method: "POST",
      sessions,
      sessionToken: credentials.sessionToken,
      now,
    }),
    (error) => error instanceof AuthenticationError && error.code === "CSRF_REJECTED",
  );
  const principal = await authorizeOwnerRequest({
    method: "POST",
    sessions,
    sessionToken: credentials.sessionToken,
    csrfToken: credentials.csrfToken,
    now,
  });
  assert.deepEqual(principal, {
    organizationId: "org-1",
    userId: "user-1",
    membershipId: "membership-1",
    role: "owner",
  });
});

test("privileged admin access requires fresh MFA evidence", async () => {
  const staleSessions = new MemorySessions();
  const stale = await login(staleSessions, {
    mfaVerifiedAt: new Date("2026-10-18T23:30:00.000Z"),
  });
  await assert.rejects(
    authorizeOwnerRequest({
      method: "GET",
      sessions: staleSessions,
      sessionToken: stale.sessionToken,
      requireFreshMfa: true,
      mfaMaxAgeSeconds: 900,
      now,
    }),
    (error) => error instanceof AuthenticationError && error.code === "MFA_REQUIRED",
  );

  const freshSessions = new MemorySessions();
  const fresh = await login(freshSessions, {
    mfaVerifiedAt: new Date("2026-10-18T23:55:00.000Z"),
  });
  await authorizeOwnerRequest({
    method: "GET",
    sessions: freshSessions,
    sessionToken: fresh.sessionToken,
    requireFreshMfa: true,
    mfaMaxAgeSeconds: 900,
    now,
  });
});

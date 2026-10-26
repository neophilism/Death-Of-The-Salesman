
import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_PRESENCE_HEARTBEAT_FRESHNESS_MS,
  deriveAgentPresence,
} from "../packages/domain/dist/index.js";

const observedAt = "2026-10-26T08:20:00.000Z";
const running = {
  source: "persisted-run",
  state: "running",
  reason: "Executing verified work item work-42",
  lastActivityAt: "2026-10-26T08:19:55.000Z",
  leaseExpiresAt: "2026-10-26T08:21:00.000Z",
  heartbeatAt: "2026-10-26T08:19:50.000Z",
};
const input = (run = running) => ({
  identityStatus: "active",
  identityUpdatedAt: "2026-10-26T08:00:00.000Z",
  observedAt,
  run,
});

test("green requires a live lease and recent authoritative heartbeat", () => {
  const result = deriveAgentPresence(input());
  assert.deepEqual(result, {
    color: "green",
    state: "running",
    reason: "Executing verified work item work-42",
    lastActivityAt: "2026-10-26T08:19:55.000Z",
    authoritative: true,
    runState: "running",
    leaseExpiresAt: "2026-10-26T08:21:00.000Z",
    heartbeatAt: "2026-10-26T08:19:50.000Z",
  });
  assert.equal(AGENT_PRESENCE_HEARTBEAT_FRESHNESS_MS, 30_000);
});

test("running state fails red for a missing, expired, or stale lease signal", () => {
  assert.match(
    deriveAgentPresence(input({ ...running, leaseExpiresAt: null })).reason,
    /no valid lease/,
  );
  assert.match(
    deriveAgentPresence(input({ ...running, leaseExpiresAt: observedAt })).reason,
    /lease expired/,
  );
  assert.match(
    deriveAgentPresence(input({ ...running, heartbeatAt: null })).reason,
    /no worker heartbeat/,
  );
  const stale = deriveAgentPresence(input({
    ...running,
    heartbeatAt: "2026-10-26T08:19:29.999Z",
  }));
  assert.equal(stale.color, "red");
  assert.match(stale.reason, /stale since 2026-10-26T08:19:29.999Z/);
});

test("queue, review, schedule, rate-limit, and budget waits are yellow with exact evidence", () => {
  for (const state of [
    "queued",
    "waiting-for-approval",
    "scheduled",
    "rate-limited",
    "waiting-for-budget",
    "blocked",
  ]) {
    const result = deriveAgentPresence(input({
      ...running,
      state,
      reason: `Exact ${state} reason`,
      leaseExpiresAt: null,
      heartbeatAt: null,
    }));
    assert.equal(result.color, "yellow");
    assert.equal(result.state, "waiting");
    assert.equal(result.reason, `Exact ${state} reason`);
    assert.equal(result.lastActivityAt, running.lastActivityAt);
  }
});

test("inactive, terminal, missing, and untrusted states cannot appear live", () => {
  const inactive = deriveAgentPresence({
    ...input(),
    identityStatus: "inactive",
  });
  assert.equal(inactive.color, "red");
  assert.equal(inactive.authoritative, true);
  assert.match(inactive.reason, /identity is inactive/);

  const inactiveSynthetic = deriveAgentPresence({
    ...input({ ...running, source: "synthetic-preview" }),
    identityStatus: "inactive",
  });
  assert.equal(inactiveSynthetic.color, "red");
  assert.equal(inactiveSynthetic.authoritative, false);

  const complete = deriveAgentPresence(input({
    ...running,
    state: "completed",
    reason: "Run completed",
    leaseExpiresAt: null,
    heartbeatAt: null,
  }));
  assert.equal(complete.color, "red");
  assert.equal(complete.reason, "Run completed");

  const absent = deriveAgentPresence(input(null));
  assert.equal(absent.color, "red");
  assert.equal(absent.authoritative, false);

  const simulated = deriveAgentPresence(input({
    ...running,
    source: "synthetic-preview",
  }));
  assert.equal(simulated.color, "red");
  assert.equal(simulated.authoritative, false);
  assert.match(simulated.reason, /not authoritative/);
});

test("timestamps, freshness, and visible reasons fail closed", () => {
  assert.throws(
    () => deriveAgentPresence({ ...input(), observedAt: "not-a-time" }),
    /canonical UTC timestamp/,
  );
  assert.throws(
    () => deriveAgentPresence(input({
      ...running,
      heartbeatAt: "2026-10-26T08:20:01.000Z",
    })),
    /cannot be in the future/,
  );
  assert.throws(
    () => deriveAgentPresence(input({ ...running, reason: " " })),
    /1 to 240 characters/,
  );
  assert.throws(
    () => deriveAgentPresence({ ...input(), heartbeatFreshnessMs: 0 }),
    /1 to 300000/,
  );
});


export const AGENT_PRESENCE_HEARTBEAT_FRESHNESS_MS = 30_000;

export type AgentRunState =
  | "created"
  | "eligible"
  | "reserved"
  | "running"
  | "drafted"
  | "waiting-for-approval"
  | "waiting-for-reply"
  | "waiting-for-budget"
  | "blocked"
  | "queued"
  | "scheduled"
  | "rate-limited"
  | "paused"
  | "completed"
  | "failed-retryable"
  | "failed-final"
  | "cancelled"
  | "recovering";

export type AuthoritativeAgentRun = {
  readonly source: "persisted-run";
  readonly state: AgentRunState;
  readonly reason: string;
  readonly lastActivityAt: string;
  readonly leaseExpiresAt: string | null;
  readonly heartbeatAt: string | null;
};

export type AgentPresence = {
  readonly color: "green" | "yellow" | "red";
  readonly state: "running" | "waiting" | "inactive";
  readonly reason: string;
  readonly lastActivityAt: string;
  readonly authoritative: boolean;
  readonly runState: AgentRunState | null;
  readonly leaseExpiresAt: string | null;
  readonly heartbeatAt: string | null;
};

export type DeriveAgentPresenceInput = {
  readonly identityStatus: "active" | "inactive" | "archived";
  readonly identityUpdatedAt: string;
  readonly observedAt: string;
  readonly run: AuthoritativeAgentRun | null;
  readonly heartbeatFreshnessMs?: number;
};

const WAITING_STATES = new Set<AgentRunState>([
  "created",
  "eligible",
  "reserved",
  "drafted",
  "waiting-for-approval",
  "waiting-for-reply",
  "waiting-for-budget",
  "blocked",
  "queued",
  "scheduled",
  "rate-limited",
  "paused",
]);

const timestampMillis = (value: string, label: string): number => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(`${label} must be a canonical UTC timestamp`);
  }
  return parsed.getTime();
};

const boundedReason = (value: string): string => {
  const reason = value.trim();
  if (!reason || reason.length > 240) {
    throw new Error("presence reason must contain 1 to 240 characters");
  }
  return reason;
};

const presence = (
  color: AgentPresence["color"],
  state: AgentPresence["state"],
  reason: string,
  lastActivityAt: string,
  authoritative: boolean,
  run: AuthoritativeAgentRun | null,
): AgentPresence => Object.freeze({
  color,
  state,
  reason,
  lastActivityAt,
  authoritative,
  runState: run?.state ?? null,
  leaseExpiresAt: run?.leaseExpiresAt ?? null,
  heartbeatAt: run?.heartbeatAt ?? null,
});

export const deriveAgentPresence = (input: DeriveAgentPresenceInput): AgentPresence => {
  const observedAt = timestampMillis(input.observedAt, "observedAt");
  timestampMillis(input.identityUpdatedAt, "identityUpdatedAt");
  const freshness = input.heartbeatFreshnessMs ?? AGENT_PRESENCE_HEARTBEAT_FRESHNESS_MS;
  if (!Number.isSafeInteger(freshness) || freshness < 1 || freshness > 300_000) {
    throw new Error("heartbeatFreshnessMs must be an integer from 1 to 300000");
  }

  if (input.identityStatus !== "active") {
    return presence(
      "red",
      "inactive",
      `Agent identity is ${input.identityStatus}`,
      input.identityUpdatedAt,
      input.run?.source === "persisted-run",
      input.run,
    );
  }
  if (input.run === null) {
    return presence(
      "red",
      "inactive",
      "No authoritative run state",
      input.identityUpdatedAt,
      false,
      null,
    );
  }
  if (input.run.source !== "persisted-run") {
    return presence(
      "red",
      "inactive",
      "Run state is not authoritative",
      input.identityUpdatedAt,
      false,
      input.run,
    );
  }

  const reason = boundedReason(input.run.reason);
  const lastActivityAt = timestampMillis(input.run.lastActivityAt, "run.lastActivityAt");
  if (lastActivityAt > observedAt) throw new Error("run.lastActivityAt cannot be in the future");
  const leaseExpiresAt = input.run.leaseExpiresAt === null
    ? null
    : timestampMillis(input.run.leaseExpiresAt, "run.leaseExpiresAt");
  const heartbeatAt = input.run.heartbeatAt === null
    ? null
    : timestampMillis(input.run.heartbeatAt, "run.heartbeatAt");
  if (heartbeatAt !== null && heartbeatAt > observedAt) {
    throw new Error("run.heartbeatAt cannot be in the future");
  }

  if (input.run.state === "running") {
    if (leaseExpiresAt === null) {
      return presence("red", "inactive", "Running state has no valid lease", input.run.lastActivityAt, true, input.run);
    }
    if (leaseExpiresAt <= observedAt) {
      return presence("red", "inactive", `Run lease expired at ${input.run.leaseExpiresAt}`, input.run.lastActivityAt, true, input.run);
    }
    if (heartbeatAt === null) {
      return presence("red", "inactive", "Running state has no worker heartbeat", input.run.lastActivityAt, true, input.run);
    }
    if (observedAt - heartbeatAt > freshness) {
      return presence("red", "inactive", `Worker heartbeat is stale since ${input.run.heartbeatAt}`, input.run.lastActivityAt, true, input.run);
    }
    return presence("green", "running", reason, input.run.lastActivityAt, true, input.run);
  }

  if (WAITING_STATES.has(input.run.state)) {
    return presence("yellow", "waiting", reason, input.run.lastActivityAt, true, input.run);
  }

  return presence("red", "inactive", reason, input.run.lastActivityAt, true, input.run);
};

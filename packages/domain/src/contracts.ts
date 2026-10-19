export const CONTRACT_SCHEMA_VERSION = "2026-10-01" as const;

export const CONTRACT_KINDS = [
  "project",
  "agent",
  "campaign",
  "contact",
  "workItem",
  "event",
  "approval",
  "usage",
  "error",
] as const;

export type ContractKind = (typeof CONTRACT_KINDS)[number];

export interface ContractDataByKind {
  readonly project: {
    readonly id: string;
    readonly organizationId: string;
    readonly name: string;
    readonly status: "active" | "archived";
  };
  readonly agent: {
    readonly id: string;
    readonly organizationId: string;
    readonly name: string;
    readonly status: "active" | "inactive";
  };
  readonly campaign: {
    readonly id: string;
    readonly projectId: string;
    readonly name: string;
    readonly status: "draft" | "active" | "paused" | "completed";
  };
  readonly contact: {
    readonly id: string;
    readonly organizationId: string;
    readonly displayName: string;
    readonly status: "active" | "suppressed" | "archived";
  };
  readonly workItem: {
    readonly id: string;
    readonly projectId: string;
    readonly assigneeAgentId: string | null;
    readonly status: "queued" | "running" | "waiting" | "completed" | "failed";
  };
  readonly event: {
    readonly id: string;
    readonly organizationId: string;
    readonly type: string;
    readonly occurredAt: string;
  };
  readonly approval: {
    readonly id: string;
    readonly organizationId: string;
    readonly action: string;
    readonly status: "pending" | "approved" | "rejected" | "expired" | "consumed";
  };
  readonly usage: {
    readonly id: string;
    readonly organizationId: string;
    readonly unit: "request" | "token" | "cent" | "byte";
    readonly quantity: number;
  };
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly retryable: boolean;
  };
}

export type ContractEnvelope<K extends ContractKind = ContractKind> = {
  readonly schemaVersion: typeof CONTRACT_SCHEMA_VERSION;
  readonly kind: K;
  readonly data: ContractDataByKind[K];
};

type FieldRule =
  | { readonly type: "string" }
  | { readonly type: "boolean" }
  | { readonly type: "integer"; readonly minimum: number }
  | { readonly type: "nullableString" }
  | { readonly type: "enum"; readonly values: readonly string[] }
  | { readonly type: "utcTimestamp" };

type ObjectSchema = Readonly<Record<string, FieldRule>>;

const enumRule = (...values: string[]): FieldRule => ({ type: "enum", values });

export const CONTRACT_SCHEMAS = Object.freeze({
  project: {
    id: { type: "string" },
    organizationId: { type: "string" },
    name: { type: "string" },
    status: enumRule("active", "archived"),
  },
  agent: {
    id: { type: "string" },
    organizationId: { type: "string" },
    name: { type: "string" },
    status: enumRule("active", "inactive"),
  },
  campaign: {
    id: { type: "string" },
    projectId: { type: "string" },
    name: { type: "string" },
    status: enumRule("draft", "active", "paused", "completed"),
  },
  contact: {
    id: { type: "string" },
    organizationId: { type: "string" },
    displayName: { type: "string" },
    status: enumRule("active", "suppressed", "archived"),
  },
  workItem: {
    id: { type: "string" },
    projectId: { type: "string" },
    assigneeAgentId: { type: "nullableString" },
    status: enumRule("queued", "running", "waiting", "completed", "failed"),
  },
  event: {
    id: { type: "string" },
    organizationId: { type: "string" },
    type: { type: "string" },
    occurredAt: { type: "utcTimestamp" },
  },
  approval: {
    id: { type: "string" },
    organizationId: { type: "string" },
    action: { type: "string" },
    status: enumRule("pending", "approved", "rejected", "expired", "consumed"),
  },
  usage: {
    id: { type: "string" },
    organizationId: { type: "string" },
    unit: enumRule("request", "token", "cent", "byte"),
    quantity: { type: "integer", minimum: 0 },
  },
  error: {
    code: { type: "string" },
    message: { type: "string" },
    retryable: { type: "boolean" },
  },
} satisfies Readonly<Record<ContractKind, ObjectSchema>>);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertExactKeys = (value: Record<string, unknown>, keys: readonly string[], label: string): void => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly: ${expected.join(", ")}`);
  }
};

const assertField = (name: string, value: unknown, rule: FieldRule): void => {
  if (rule.type === "string" && (typeof value !== "string" || value.trim() === "")) {
    throw new Error(`${name} must be a non-empty string`);
  }
  if (rule.type === "boolean" && typeof value !== "boolean") {
    throw new Error(`${name} must be a boolean`);
  }
  if (rule.type === "nullableString" && value !== null && (typeof value !== "string" || value.trim() === "")) {
    throw new Error(`${name} must be null or a non-empty string`);
  }
  if (rule.type === "enum" && (typeof value !== "string" || !rule.values.includes(value))) {
    throw new Error(`${name} must be one of: ${rule.values.join(", ")}`);
  }
  if (
    rule.type === "integer" &&
    (typeof value !== "number" || !Number.isSafeInteger(value) || value < rule.minimum)
  ) {
    throw new Error(`${name} must be a safe integer at least ${rule.minimum}`);
  }
  if (rule.type === "utcTimestamp") {
    const matchesShape =
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value);
    const normalized = matchesShape && !value.includes(".") ? value.replace("Z", ".000Z") : value;
    if (
      !matchesShape ||
      typeof normalized !== "string" ||
      Number.isNaN(Date.parse(normalized)) ||
      new Date(normalized).toISOString() !== normalized
    ) {
      throw new Error(`${name} must be a real ISO 8601 UTC timestamp`);
    }
  }
};

export const parseContract = <K extends ContractKind>(value: unknown): ContractEnvelope<K> => {
  if (!isObject(value)) throw new Error("contract must be an object");
  assertExactKeys(value, ["schemaVersion", "kind", "data"], "contract");
  if (value.schemaVersion !== CONTRACT_SCHEMA_VERSION) {
    throw new Error(`unsupported schemaVersion; expected ${CONTRACT_SCHEMA_VERSION}`);
  }
  if (typeof value.kind !== "string" || !CONTRACT_KINDS.includes(value.kind as ContractKind)) {
    throw new Error("kind must identify a supported contract");
  }
  if (!isObject(value.data)) throw new Error("data must be an object");
  const kind = value.kind as ContractKind;
  const schema = CONTRACT_SCHEMAS[kind];
  assertExactKeys(value.data, Object.keys(schema), `${kind}.data`);
  for (const [field, rule] of Object.entries(schema)) {
    assertField(`${kind}.data.${field}`, value.data[field], rule);
  }
  return value as ContractEnvelope<K>;
};

export const serializeContract = (contract: ContractEnvelope): string => JSON.stringify(parseContract(contract));

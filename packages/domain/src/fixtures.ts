import {
  CONTRACT_SCHEMA_VERSION,
  parseContract,
  type ContractEnvelope,
  type ContractKind,
} from "./contracts.js";

export interface SyntheticPreviewGuard {
  readonly modelApiEnabled?: boolean;
  readonly emailDeliveryEnabled?: boolean;
  readonly paidSpendLimitCents?: number;
}

export interface SyntheticThread {
  readonly id: string;
  readonly contactId: string;
  readonly campaignId: string;
  readonly label: "Synthetic";
  readonly messages: readonly [{
    readonly direction: "outbound";
    readonly body: string;
    readonly status: "draft";
  }];
}

export interface SyntheticMetric {
  readonly label: string;
  readonly value: number;
  readonly unit: "count" | "percent";
  readonly synthetic: true;
}

export interface SyntheticPreview {
  readonly mode: "synthetic";
  readonly label: "Synthetic";
  readonly seed: string;
  readonly safety: {
    readonly outboundDeliveryEnabled: false;
    readonly meteredInferenceEnabled: false;
    readonly paidSpendLimitCents: 0;
  };
  readonly account: {
    readonly organizationId: string;
    readonly displayName: string;
  };
  readonly contracts: readonly ContractEnvelope[];
  readonly threads: readonly SyntheticThread[];
  readonly metrics: readonly SyntheticMetric[];
}

const normalizeSeed = (seed: string): string => {
  const normalized = seed.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(normalized)) {
    throw new Error("synthetic preview seed must contain 1-64 lowercase letters, digits, or hyphens");
  }
  return normalized;
};

const hashSeed = (value: string): string => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const envelope = <K extends ContractKind>(
  kind: K,
  data: ContractEnvelope<K>["data"],
): ContractEnvelope<K> =>
  parseContract<K>({ schemaVersion: CONTRACT_SCHEMA_VERSION, kind, data });

const assertPreviewGuard = (guard: SyntheticPreviewGuard): void => {
  if (
    guard.modelApiEnabled === true ||
    guard.emailDeliveryEnabled === true ||
    (guard.paidSpendLimitCents ?? 0) !== 0
  ) {
    throw new Error("synthetic preview requires disabled delivery, disabled inference, and zero paid spend");
  }
};

export const createSyntheticPreview = (
  seed = "default",
  guard: SyntheticPreviewGuard = {},
): SyntheticPreview => {
  assertPreviewGuard(guard);
  const normalizedSeed = normalizeSeed(seed);
  const suffix = hashSeed(normalizedSeed);
  const organizationId = `synthetic-org-${suffix}`;
  const projectId = `synthetic-project-${suffix}`;
  const campaignId = `synthetic-campaign-${suffix}`;
  const contactIds = [1, 2, 3].map((index) => `synthetic-contact-${suffix}-${index}`);
  const fastEddieAgentId = `synthetic-agent-${suffix}-fast-eddie`;
  const harryAgentId = `synthetic-agent-${suffix}-harry`;

  const contracts: ContractEnvelope[] = [
    envelope("project", {
      id: projectId,
      organizationId,
      name: "Synthetic Pipeline Preview",
      status: "active",
    }),
    envelope("agent", {
      id: fastEddieAgentId,
      organizationId,
      name: "Fast Eddie Felson",
      status: "inactive",
    }),
    envelope("agent", {
      id: harryAgentId,
      organizationId,
      name: "Harry Wormwood",
      status: "inactive",
    }),
    envelope("campaign", {
      id: campaignId,
      projectId,
      name: "Synthetic Draft Campaign",
      status: "draft",
    }),
    ...contactIds.map((id, index) =>
      envelope("contact", {
        id,
        organizationId,
        displayName: `Synthetic Contact ${index + 1}`,
        status: "suppressed",
      }),
    ),
    envelope("workItem", {
      id: `synthetic-work-${suffix}`,
      projectId,
      assigneeAgentId: null,
      status: "waiting",
    }),
    envelope("event", {
      id: `synthetic-event-${suffix}`,
      organizationId,
      type: "synthetic.preview.created",
      occurredAt: "2026-10-19T00:00:00Z",
    }),
    envelope("approval", {
      id: `synthetic-approval-${suffix}`,
      organizationId,
      action: "synthetic.preview.no-send",
      status: "pending",
    }),
    envelope("usage", {
      id: `synthetic-usage-${suffix}`,
      organizationId,
      unit: "request",
      quantity: 0,
    }),
  ];

  const threads = contactIds.map((contactId, index): SyntheticThread => ({
    id: `synthetic-thread-${suffix}-${index + 1}`,
    contactId,
    campaignId,
    label: "Synthetic",
    messages: [{
      direction: "outbound",
      body: `Synthetic draft for preview contact ${index + 1}. No message can be sent.`,
      status: "draft",
    }],
  }));

  return Object.freeze({
    mode: "synthetic",
    label: "Synthetic",
    seed: normalizedSeed,
    safety: Object.freeze({
      outboundDeliveryEnabled: false,
      meteredInferenceEnabled: false,
      paidSpendLimitCents: 0,
    }),
    account: Object.freeze({
      organizationId,
      displayName: "Synthetic Preview Account",
    }),
    contracts: Object.freeze(contracts),
    threads: Object.freeze(threads),
    metrics: Object.freeze([
      Object.freeze({ label: "Synthetic contacts", value: 3, unit: "count", synthetic: true }),
      Object.freeze({ label: "Drafts sent", value: 0, unit: "count", synthetic: true }),
      Object.freeze({ label: "Metered requests", value: 0, unit: "count", synthetic: true }),
      Object.freeze({ label: "Synthetic reply rate", value: 0, unit: "percent", synthetic: true }),
    ]),
  });
};

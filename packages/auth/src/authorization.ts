import type { MembershipRole } from "./index.js";

export const authorizationActions = [
  "organization.manage",
  "membership.manage",
  "credential.manage",
  "policy.manage",
  "approval.decide",
  "spend.authorize",
  "message.send",
  "audit.read",
  "project.read",
  "project.write",
  "campaign.read",
  "campaign.write",
  "contact.read",
  "contact.write",
  "agent.assign",
  "message.draft",
  "work_item.update",
] as const;

export type AuthorizationAction = (typeof authorizationActions)[number];

const ownerOnlyActions = new Set<AuthorizationAction>([
  "organization.manage",
  "credential.manage",
  "approval.decide",
  "spend.authorize",
  "message.send",
]);

const roleActions: Record<MembershipRole, ReadonlySet<AuthorizationAction>> = {
  owner: new Set(authorizationActions),
  admin: new Set([
    "membership.manage",
    "policy.manage",
    "audit.read",
    "project.read",
    "project.write",
    "campaign.read",
    "campaign.write",
    "contact.read",
    "contact.write",
    "agent.assign",
    "message.draft",
    "work_item.update",
  ]),
  sales_manager: new Set([
    "project.read",
    "campaign.read",
    "campaign.write",
    "contact.read",
    "contact.write",
    "agent.assign",
    "message.draft",
    "work_item.update",
  ]),
};

export type AuthorizationTarget = {
  organizationId: string;
  projectId?: string;
  campaignId?: string;
};

export type HumanPrincipal = {
  kind: "human";
  organizationId: string;
  userId: string;
  membershipId: string;
  role: MembershipRole;
};

const agentDelegatableActions = new Set<AuthorizationAction>([
  "project.read",
  "campaign.read",
  "contact.read",
  "contact.write",
  "message.draft",
  "work_item.update",
]);

export type AgentGrant = {
  action: AuthorizationAction;
  projectIds: readonly string[];
  campaignIds: readonly string[];
};

export type AgentPrincipal = {
  kind: "agent";
  organizationId: string;
  agentId: string;
  grants: readonly AgentGrant[];
};

export type AuthorizationPrincipal = HumanPrincipal | AgentPrincipal;

export type AuthorizationFilter = {
  organizationId: string;
  projectIds?: readonly string[];
  campaignIds?: readonly string[];
};

export type AuthorizationDecision =
  | { allowed: true; filter: AuthorizationFilter }
  | { allowed: false; reason: "cross_tenant" | "role_denied" | "scope_denied" };

export class AuthorizationError extends Error {
  readonly status = 403;

  constructor(readonly reason: Exclude<AuthorizationDecision, { allowed: true }>["reason"]) {
    super("actor is not authorized for this operation");
    this.name = "AuthorizationError";
  }
}

const uniqueNonEmpty = (values: readonly string[], name: string): readonly string[] => {
  const normalized = values.map((value) => value.trim());
  if (normalized.some((value) => value.length === 0) || new Set(normalized).size !== normalized.length) {
    throw new Error(`${name} must contain unique non-empty IDs`);
  }
  return Object.freeze(normalized);
};

export const createAgentPrincipal = (input: {
  organizationId: string;
  agentId: string;
  grants: readonly AgentGrant[];
}): AgentPrincipal => {
  if (!input.organizationId.trim() || !input.agentId.trim()) {
    throw new Error("agent organization and ID are required");
  }

  const grants = input.grants.map((grant) => {
    if (!agentDelegatableActions.has(grant.action) || ownerOnlyActions.has(grant.action)) {
      throw new Error(`${grant.action} cannot be delegated to an agent`);
    }
    return Object.freeze({
      action: grant.action,
      projectIds: uniqueNonEmpty(grant.projectIds, "projectIds"),
      campaignIds: uniqueNonEmpty(grant.campaignIds, "campaignIds"),
    });
  });

  return Object.freeze({
    kind: "agent",
    organizationId: input.organizationId,
    agentId: input.agentId,
    grants: Object.freeze(grants),
  });
};

const includesTarget = (grant: AgentGrant, target: AuthorizationTarget): boolean =>
  (!target.projectId || grant.projectIds.includes(target.projectId)) &&
  (!target.campaignId || grant.campaignIds.includes(target.campaignId));

export const decideAuthorization = (
  principal: AuthorizationPrincipal,
  action: AuthorizationAction,
  target: AuthorizationTarget,
): AuthorizationDecision => {
  if (principal.organizationId !== target.organizationId) {
    return { allowed: false, reason: "cross_tenant" };
  }

  if (principal.kind === "human") {
    return roleActions[principal.role].has(action)
      ? { allowed: true, filter: { organizationId: principal.organizationId } }
      : { allowed: false, reason: "role_denied" };
  }

  if (ownerOnlyActions.has(action) || !agentDelegatableActions.has(action)) {
    return { allowed: false, reason: "role_denied" };
  }

  const matching = principal.grants.filter(
    (grant) => grant.action === action && includesTarget(grant, target),
  );
  if (matching.length === 0) return { allowed: false, reason: "scope_denied" };

  return {
    allowed: true,
    filter: {
      organizationId: principal.organizationId,
      projectIds: uniqueNonEmpty(matching.flatMap((grant) => grant.projectIds), "projectIds"),
      campaignIds: uniqueNonEmpty(matching.flatMap((grant) => grant.campaignIds), "campaignIds"),
    },
  };
};

export const requireAuthorization = (
  principal: AuthorizationPrincipal,
  action: AuthorizationAction,
  target: AuthorizationTarget,
): AuthorizationFilter => {
  const decision = decideAuthorization(principal, action, target);
  if (!decision.allowed) throw new AuthorizationError(decision.reason);
  return decision.filter;
};

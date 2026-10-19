export type HumanRole = "owner" | "admin" | "sales_manager";

export type Scope =
  | "organization:transfer"
  | "memberships:manage"
  | "settings:write"
  | "projects:read"
  | "projects:write"
  | "contacts:read"
  | "contacts:write"
  | "agents:delegate"
  | "approvals:resolve"
  | "audit:read"
  | "work:execute"
  | "proposals:create";

export type AgentScope =
  | "projects:read"
  | "contacts:read"
  | "work:execute"
  | "proposals:create";

export type ResourceFilter = {
  projectIds: readonly string[];
  campaignIds: readonly string[];
  contactIds: readonly string[];
};

export type ResourceSelector = {
  projectId?: string;
  campaignId?: string;
  contactId?: string;
};

export type HumanPrincipal = {
  kind: "human";
  organizationId: string;
  userId: string;
  membershipId: string;
  role: HumanRole;
  membershipStatus: "active" | "inactive";
};

export type AgentPrincipal = {
  kind: "agent";
  organizationId: string;
  subject: string;
  grantId: string;
  scopes: readonly AgentScope[];
  resources: ResourceFilter;
  expiresAt: Date;
  revokedAt?: Date;
};

export type Principal = HumanPrincipal | AgentPrincipal;

export type AuthorizationDecision = {
  organizationId: string;
  scope: Scope;
  resources: ResourceFilter | { organizationOnly: true };
};

export class AuthorizationError extends Error {
  constructor(
    readonly code:
      | "UNAUTHORIZED"
      | "CROSS_TENANT"
      | "EXPIRED_DELEGATION"
      | "RESOURCE_DENIED"
      | "UNKNOWN_ENDPOINT",
    message = "request is not authorized",
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

const allScopes: readonly Scope[] = [
  "organization:transfer",
  "memberships:manage",
  "settings:write",
  "projects:read",
  "projects:write",
  "contacts:read",
  "contacts:write",
  "agents:delegate",
  "approvals:resolve",
  "audit:read",
  "work:execute",
  "proposals:create",
];

const allowedAgentScopes: ReadonlySet<Scope> = new Set([
  "projects:read",
  "contacts:read",
  "work:execute",
  "proposals:create",
]);

const roleScopes: Readonly<Record<HumanRole, ReadonlySet<Scope>>> = {
  owner: new Set(allScopes),
  admin: new Set([
    "settings:write",
    "projects:read",
    "projects:write",
    "contacts:read",
    "contacts:write",
    "agents:delegate",
    "audit:read",
    "work:execute",
    "proposals:create",
  ]),
  sales_manager: new Set([
    "projects:read",
    "projects:write",
    "contacts:read",
    "contacts:write",
    "agents:delegate",
    "work:execute",
    "proposals:create",
  ]),
};

const endpointScopes = [
  { method: "GET", pattern: /^\/api\/v1\/projects(?:\/[^/]+)?$/, scope: "projects:read" },
  { method: "POST", pattern: /^\/api\/v1\/projects$/, scope: "projects:write" },
  { method: "PATCH", pattern: /^\/api\/v1\/projects\/[^/]+$/, scope: "projects:write" },
  { method: "GET", pattern: /^\/api\/v1\/contacts(?:\/[^/]+)?$/, scope: "contacts:read" },
  { method: "POST", pattern: /^\/api\/v1\/contacts$/, scope: "contacts:write" },
  { method: "PATCH", pattern: /^\/api\/v1\/contacts\/[^/]+$/, scope: "contacts:write" },
  { method: "POST", pattern: /^\/api\/v1\/agents\/delegations$/, scope: "agents:delegate" },
  { method: "POST", pattern: /^\/api\/v1\/owner-actions\/[^/]+\/resolve$/, scope: "approvals:resolve" },
  { method: "GET", pattern: /^\/api\/v1\/audit-events$/, scope: "audit:read" },
  { method: "PATCH", pattern: /^\/api\/v1\/organization$/, scope: "settings:write" },
  { method: "POST", pattern: /^\/api\/v1\/organization\/transfer$/, scope: "organization:transfer" },
  { method: "POST", pattern: /^\/api\/v1\/work-items\/[^/]+\/execute$/, scope: "work:execute" },
  { method: "POST", pattern: /^\/api\/v1\/proposals$/, scope: "proposals:create" },
] as const satisfies readonly {
  method: string;
  pattern: RegExp;
  scope: Scope;
}[];

const includesResource = (allowed: readonly string[], requested: string | undefined): boolean =>
  requested === undefined || allowed.includes(requested);

const requireAgentResource = (principal: AgentPrincipal, resource: ResourceSelector): void => {
  if (!resource.projectId && !resource.campaignId && !resource.contactId) {
    throw new AuthorizationError("RESOURCE_DENIED");
  }
  if (
    !includesResource(principal.resources.projectIds, resource.projectId) ||
    !includesResource(principal.resources.campaignIds, resource.campaignId) ||
    !includesResource(principal.resources.contactIds, resource.contactId)
  ) {
    throw new AuthorizationError("RESOURCE_DENIED");
  }
};

export function authorize(input: {
  principal: Principal;
  organizationId: string;
  scope: Scope;
  resource?: ResourceSelector;
  now?: Date;
}): AuthorizationDecision {
  const now = input.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw new Error("now must be a valid date");
  if (input.principal.organizationId !== input.organizationId) {
    throw new AuthorizationError("CROSS_TENANT");
  }

  if (input.principal.kind === "human") {
    if (
      input.principal.membershipStatus !== "active" ||
      !roleScopes[input.principal.role].has(input.scope)
    ) {
      throw new AuthorizationError("UNAUTHORIZED");
    }
    return {
      organizationId: input.organizationId,
      scope: input.scope,
      resources: { organizationOnly: true },
    };
  }

  if (
    input.principal.revokedAt ||
    !Number.isFinite(input.principal.expiresAt.getTime()) ||
    input.principal.expiresAt.getTime() <= now.getTime()
  ) {
    throw new AuthorizationError("EXPIRED_DELEGATION");
  }
  if (
    !allowedAgentScopes.has(input.scope) ||
    !input.principal.scopes.includes(input.scope as AgentScope)
  ) {
    throw new AuthorizationError("UNAUTHORIZED");
  }
  requireAgentResource(input.principal, input.resource ?? {});
  return {
    organizationId: input.organizationId,
    scope: input.scope,
    resources: input.principal.resources,
  };
}

export function authorizeEndpoint(input: {
  principal: Principal;
  organizationId: string;
  method: string;
  path: string;
  resource?: ResourceSelector;
  now?: Date;
}): AuthorizationDecision {
  const route = endpointScopes.find(
    (candidate) =>
      candidate.method === input.method.toUpperCase() && candidate.pattern.test(input.path),
  );
  if (!route) throw new AuthorizationError("UNKNOWN_ENDPOINT");

  const projectPathId = input.path.match(/^\/api\/v1\/projects\/([^/]+)$/)?.[1];
  const contactPathId = input.path.match(/^\/api\/v1\/contacts\/([^/]+)$/)?.[1];
  if (
    (projectPathId && input.resource?.projectId && projectPathId !== input.resource.projectId) ||
    (contactPathId && input.resource?.contactId && contactPathId !== input.resource.contactId)
  ) {
    throw new AuthorizationError("RESOURCE_DENIED");
  }

  return authorize({
    principal: input.principal,
    organizationId: input.organizationId,
    scope: route.scope,
    resource: {
      ...input.resource,
      ...(projectPathId ? { projectId: projectPathId } : {}),
      ...(contactPathId ? { contactId: contactPathId } : {}),
    },
    now: input.now,
  });
}

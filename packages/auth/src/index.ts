import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export type MembershipRole = "owner" | "admin" | "sales_manager";

export type VerifiedOidcClaims = {
  issuer: string;
  subject: string;
  authenticatedAt: Date;
  mfaVerifiedAt?: Date;
};

export type ActiveMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: MembershipRole;
};

export type SessionRecord = {
  id: string;
  organizationId: string;
  userId: string;
  membershipId: string;
  role: MembershipRole;
  tokenHash: string;
  csrfHash: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  idleExpiresAt: Date;
  idleTimeoutSeconds: number;
  mfaVerifiedAt?: Date;
  revokedAt?: Date;
};

export interface OidcVerifier {
  verifyIdToken(idToken: string): Promise<VerifiedOidcClaims>;
}

export interface IdentityDirectory {
  findUserId(issuer: string, subject: string): Promise<string | undefined>;
  findActiveMembership(userId: string, organizationId: string): Promise<ActiveMembership | undefined>;
}

export interface SessionStore {
  create(session: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | undefined>;
  touch(id: string, lastSeenAt: Date, idleExpiresAt: Date): Promise<void>;
}

export type SessionCredentials = {
  sessionToken: string;
  csrfToken: string;
  expiresAt: Date;
};

export class AuthenticationError extends Error {
  constructor(
    readonly code: "UNAUTHENTICATED" | "CSRF_REJECTED" | "MFA_REQUIRED",
    message: string,
    readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthenticationError";
  }
}

const hashToken = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex");

const randomToken = (): string => randomBytes(32).toString("base64url");

const validDuration = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
};

const validClaims = (claims: VerifiedOidcClaims): void => {
  if (!claims.issuer.trim() || !claims.subject.trim()) {
    throw new AuthenticationError("UNAUTHENTICATED", "identity could not be verified", 401);
  }
  if (!Number.isFinite(claims.authenticatedAt.getTime())) {
    throw new AuthenticationError("UNAUTHENTICATED", "identity could not be verified", 401);
  }
};

export async function startOwnerSession(input: {
  idToken: string;
  organizationId: string;
  verifier: OidcVerifier;
  directory: IdentityDirectory;
  sessions: SessionStore;
  now?: Date;
  absoluteTtlSeconds?: number;
  idleTtlSeconds?: number;
  maximumAuthenticationAgeSeconds?: number;
}): Promise<SessionCredentials> {
  const now = input.now ?? new Date();
  const absoluteTtlSeconds = validDuration(input.absoluteTtlSeconds ?? 8 * 60 * 60, "absoluteTtlSeconds");
  const idleTtlSeconds = validDuration(input.idleTtlSeconds ?? 30 * 60, "idleTtlSeconds");
  const maximumAuthenticationAgeSeconds = validDuration(
    input.maximumAuthenticationAgeSeconds ?? 5 * 60,
    "maximumAuthenticationAgeSeconds",
  );
  if (!Number.isFinite(now.getTime())) throw new Error("now must be a valid date");
  const claims = await input.verifier.verifyIdToken(input.idToken);
  validClaims(claims);
  if (
    claims.mfaVerifiedAt &&
    (!Number.isFinite(claims.mfaVerifiedAt.getTime()) || claims.mfaVerifiedAt.getTime() > now.getTime())
  ) {
    throw new AuthenticationError("UNAUTHENTICATED", "identity could not be verified", 401);
  }

  const authenticationAge = now.getTime() - claims.authenticatedAt.getTime();
  if (authenticationAge < -60_000 || authenticationAge > maximumAuthenticationAgeSeconds * 1_000) {
    throw new AuthenticationError("UNAUTHENTICATED", "identity could not be verified", 401);
  }

  const userId = await input.directory.findUserId(claims.issuer, claims.subject);
  const membership = userId
    ? await input.directory.findActiveMembership(userId, input.organizationId)
    : undefined;
  if (!membership || membership.organizationId !== input.organizationId || membership.userId !== userId) {
    throw new AuthenticationError("UNAUTHENTICATED", "identity could not be verified", 401);
  }

  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const expiresAt = new Date(now.getTime() + absoluteTtlSeconds * 1_000);
  const idleExpiresAt = new Date(Math.min(expiresAt.getTime(), now.getTime() + idleTtlSeconds * 1_000));
  const id = randomUUID();

  await input.sessions.create({
    id,
    organizationId: membership.organizationId,
    userId,
    membershipId: membership.id,
    role: membership.role,
    tokenHash: hashToken(sessionToken),
    csrfHash: hashToken(csrfToken),
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
    idleExpiresAt,
    idleTimeoutSeconds: idleTtlSeconds,
    mfaVerifiedAt: claims.mfaVerifiedAt,
  });

  return { sessionToken, csrfToken, expiresAt };
}

const unsafeMethod = (method: string): boolean =>
  !new Set(["GET", "HEAD", "OPTIONS"]).has(method.toUpperCase());

const constantTimeHashMatch = (expectedHash: string, token: string): boolean => {
  const expected = Buffer.from(expectedHash, "hex");
  const actual = Buffer.from(hashToken(token), "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

const unauthenticated = (): never => {
  throw new AuthenticationError("UNAUTHENTICATED", "owner session is missing or expired", 401);
};

export async function authorizeOwnerRequest(input: {
  sessionToken?: string;
  csrfToken?: string;
  method: string;
  sessions: SessionStore;
  now?: Date;
  requireFreshMfa?: boolean;
  mfaMaxAgeSeconds?: number;
}): Promise<Pick<SessionRecord, "organizationId" | "userId" | "membershipId" | "role">> {
  const now = input.now ?? new Date();
  if (!input.sessionToken) return unauthenticated();

  const session = await input.sessions.findByTokenHash(hashToken(input.sessionToken));
  if (
    !session ||
    session.revokedAt ||
    session.expiresAt.getTime() <= now.getTime() ||
    session.idleExpiresAt.getTime() <= now.getTime()
  ) {
    return unauthenticated();
  }

  if (
    unsafeMethod(input.method) &&
    (!input.csrfToken || !constantTimeHashMatch(session.csrfHash, input.csrfToken))
  ) {
    throw new AuthenticationError("CSRF_REJECTED", "CSRF token is missing or invalid", 403);
  }

  if (input.requireFreshMfa) {
    const maxAge = validDuration(input.mfaMaxAgeSeconds ?? 15 * 60, "mfaMaxAgeSeconds");
    if (
      !session.mfaVerifiedAt ||
      session.mfaVerifiedAt.getTime() > now.getTime() + 60_000 ||
      now.getTime() - session.mfaVerifiedAt.getTime() > maxAge * 1_000
    ) {
      throw new AuthenticationError("MFA_REQUIRED", "fresh MFA verification is required", 403);
    }
  }

  const idleExpiresAt = new Date(
    Math.min(session.expiresAt.getTime(), now.getTime() + session.idleTimeoutSeconds * 1_000),
  );
  await input.sessions.touch(session.id, now, idleExpiresAt);
  return {
    organizationId: session.organizationId,
    userId: session.userId,
    membershipId: session.membershipId,
    role: session.role,
  };
}

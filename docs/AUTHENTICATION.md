# Owner authentication and sessions

The application accepts passwordless or other OIDC login only through an injected verifier. The auth package never decodes an unverified browser claim: it receives an ID token, calls the configured verifier, resolves the immutable issuer/subject pair to an existing owner identity and active organization membership, then creates an opaque session.

Only SHA-256 hashes of the random 256-bit session and CSRF tokens are persisted. Sessions have absolute and sliding idle expiry, can be revoked, and remain bound to one user, membership and organization by a compound database foreign key. Missing, unknown, revoked, idle-expired and absolute-expired sessions all return the same unauthenticated result.

Unsafe requests require the independent CSRF token. Privileged admin operations can require recent MFA evidence from the verified OIDC authentication; the default freshness window is 15 minutes and organization policy is stored separately. DOTS-010 will add endpoint role scopes, while DOTS-011 will add request-scoped database roles and RLS.

Production deployments must use an OIDC verifier that validates issuer, audience, signature, nonce and provider time claims. Session and CSRF tokens belong in Secure, HttpOnly/SameSite cookies as appropriate for the deployment; tokens must never be logged or placed in URLs.

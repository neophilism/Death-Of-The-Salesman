# ADR 0002: Endpoint ownership

- Status: Accepted
- Date: 2026-10-19
- Owners: Web platform and API platform

## Context

The repository has a Next.js web boundary and a standalone API boundary. Without explicit
ownership, routes can be duplicated with different authentication, tenant scoping, error schemas,
or operational expectations.

## Decision

The web package owns browser rendering and web-specific route handlers under `apps/web/app`,
including `/api/health`. The API package owns product HTTP endpoints under `packages/api`, including
`/health`. The worker does not expose owner-facing HTTP endpoints.

A new product endpoint must have one owning package, one versioned contract, authentication and
authorization requirements, tenant/resource selector binding, error behavior, rate/budget effects,
and an operations owner before implementation. Shared business logic belongs in a package imported
by an owner; it must not create a second public route. Health endpoints report only their own
process boundary and never imply database, worker, storage, provider, or deployment readiness.

Moving an endpoint requires a compatibility plan and tests proving the old path is intentionally
redirected, deprecated, or removed. Production ingress and public-domain ownership remain later
deployment decisions and cannot be inferred from local listeners.

## Consequences

Reviewers can identify the accountable package and required negative tests from the route itself.
Cross-boundary duplication is rejected. Future endpoint catalogs can be generated from the owning
routes and OpenAPI without treating health checks as product readiness evidence.

# Project and offer catalog

DOTS-018 introduces tenant-owned projects, offers, pricing summaries, and vetted product facts.

## Write contract

- Every repository operation starts a transaction and sets the local PostgreSQL tenant context.
- Creates, edits, and archives require an active owner membership from the same organization.
- Child rows use organization-bound foreign keys, so an offer, pricing summary, or fact cannot reference another tenant's project or offer.
- Edits and archives require the caller's exact positive version. A stale version, missing record, archived record, inactive membership, or non-owner membership returns the same fail-closed NOT_FOUND_OR_STALE result.
- Archive is a reversible data-retention state, not a delete. Reloads return the stored status and version.
- Labels are trimmed and bounded. Structured content must be a JSON object. No model, email, paid provider, presentation bucket, or outbound action is involved.

## Endpoint shape

The OpenAPI contract exposes organization-scoped CRUD routes beneath /api/v1/projects. Authentication supplies the organization and owner membership; neither may be accepted from an unverified client claim. PATCH requests carry expectedVersion and return the incremented record. Archive uses a dedicated action route and the same optimistic version check.

The SQL repository is transport-independent. Runtime HTTP wiring must call the existing endpoint authorization gate before invoking it and must map NOT_FOUND_OR_STALE to a non-enumerating conflict/not-found response.

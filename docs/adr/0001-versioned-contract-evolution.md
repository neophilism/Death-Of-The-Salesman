# ADR 0001: Versioned contract evolution

- Status: Accepted
- Date: 2026-10-19
- Owners: Domain contracts and API platform

## Context

The web, API, and worker share exact transport envelopes. Silent reinterpretation would allow old
consumers to accept a payload with changed meaning, and permissive parsing would weaken tenant,
authorization, budget, and audit boundaries.

## Decision

`@dots/domain` remains the single runtime source for TypeScript transport contracts and
`openapi/openapi.json` remains the language-neutral representation. Every envelope carries an
exact `schemaVersion`, `kind`, and `data`. Unknown fields, unknown kinds, and unsupported versions
fail closed.

An additive change that all current consumers can ignore may extend a new explicit version. A
renamed field, changed meaning, relaxed invariant, or removed field is breaking and requires a new
version plus an intentional migration path. The implementing pull request must update runtime
parsers, serializers, OpenAPI, positive round-trip fixtures, negative version/unknown-field tests,
and consumer documentation together.

Schema versions do not grant authorization, tenant access, paid spend, or dispatch permission.
Those controls remain server-side and independently tested.

## Consequences

Contract changes are larger but reviewable as one coherent unit. Old and new versions may coexist
only when the compatibility window and removal evidence are explicit. Consumers must never infer a
new version from shape or silently coerce an unsupported payload.

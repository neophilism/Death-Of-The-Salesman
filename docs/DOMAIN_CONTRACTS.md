# Domain contracts

`@dots/domain` owns the versioned transport contracts used by the web, API and worker boundaries.
The current schema version is `2026-10-01`. Every payload is an exact envelope with
`schemaVersion`, `kind` and `data`; unknown fields, unknown kinds, empty identifiers and schema
version drift fail closed.

The canonical kinds are projects, agents, campaigns, contacts, work items, events, approvals,
usage and errors. TypeScript consumers use `ContractEnvelope`, `parseContract` and
`serializeContract`. Non-TypeScript consumers use `openapi/openapi.json`, whose component names
match those runtime kinds exactly.

Schema changes must be additive within a new explicit version or intentionally breaking under a
new version. Do not silently reinterpret an existing version. Contract tests must include a valid
round-trip fixture and negative cases for unknown fields and incompatible versions. These schemas
define transport shape only; they do not grant tenant access, approval authority, paid spend or
outbound-message permission.


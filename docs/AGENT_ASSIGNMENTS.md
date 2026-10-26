# Multi-project agent assignments

DOTS-025 adds tenant-bound project and optional campaign assignments for active agent identities.

Each assignment stores an integer priority, allocation in basis points, a positive work quota, a bounded concurrency cap and an optimistic version. One agent may serve multiple projects, while the combined allocation for that agent cannot exceed 10,000 basis points (100 percent).

Assignment writes run in one database transaction. They lock the active agent row before calculating the remaining allocation, which serializes competing allocation changes for that agent. Creation rejects duplicate agent/project/campaign targets. Updates require the exact current version; a stale or missing record returns `NOT_FOUND_OR_STALE` with `retryable: true`.

Only an active same-tenant owner may assign an active identity to an active project. Composite foreign keys and forced row-level security preserve tenant boundaries. Campaign identifiers are opaque optional links until the campaign schema is introduced; this unit does not invent campaign lifecycle behavior, scheduling, worker execution, billing or outbound authority.

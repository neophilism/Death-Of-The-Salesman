# Project bucket preferences

DOTS-019 adds tenant-owned presentation buckets and per-owner visibility and ordering preferences.
Buckets point to an active project and may carry a stable campaign identifier. The later campaign-domain
migration owns campaign lifecycle and will add its foreign key; this unit does not invent campaign state.

## Persistence contract

- Every repository operation runs in a transaction with the authenticated organization set as the local PostgreSQL tenant context.
- Creating buckets and reading or changing preferences requires an active owner membership in the same organization.
- New buckets are visible by default. A preference stores only an owner's visibility and display position; it does not archive the project or bucket.
- Preference writes use an exact positive version after creation. Missing, stale, cross-tenant, inactive, and non-owner writes return the same `NOT_FOUND_OR_STALE` result.
- Hiding or reordering a bucket changes only `project_bucket_preferences`. It never deletes or changes projects, campaigns, assignments, tasks, contacts, or evidence.
- Bucket and preference tables have forced tenant row security and organization-bound foreign keys.

The repository is transport-independent. Future HTTP and visual checkbox wiring must apply the existing owner authorization gate and send the current preference version. Optimistic UI must roll back when a stale write is rejected.

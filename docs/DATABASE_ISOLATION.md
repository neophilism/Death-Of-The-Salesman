# PostgreSQL tenant isolation

DOTS-011 adds database-enforced tenant isolation for every organization-bound table. Application
connections assume the non-login `dots_runtime` role inside a transaction and set the tenant exactly
once with `SET LOCAL app.organization_id = '<organization UUID>'`. A missing, malformed or foreign
tenant value exposes no rows and cannot authorize inserts or updates.

The migration enables and forces row-level security on organizations, memberships, organization
settings, authentication policies, owner sessions and delegation grants. Each policy applies the same
organization predicate to reads and writes. Composite foreign keys remain the separate defense against
cross-tenant membership and session references. Global identity tables are intentionally not granted to
the tenant role; authentication code must use a separately reviewed least-privilege boundary.

Migration execution requires permission to create the `dots_runtime` group role. The role is
`NOLOGIN`, `NOBYPASSRLS` and has no database, role, replication or superuser privileges. Production
login roles should receive membership only after deployment configuration review. Never grant table
ownership, superuser or `BYPASSRLS` to an application login.

PostgreSQL 17 CI proves that tenant one cannot read tenant two by direct ID guess or protected joins,
cannot write a tenant-two row, and can read its own rows. Rollback removes every policy, grant, helper
function and role before earlier migrations are reversed.

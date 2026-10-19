# Tenant and membership domain

Organizations, owner identities, memberships and versioned organization settings live in the
`app` schema. All records use database-generated UUID ownership keys and `timestamptz` instants.
Organization slugs and external identity subjects are unique stable identifiers; mutable display
names are not identity keys.

A user can hold memberships in more than one organization, but every organization-owned reference
must carry the organization ID with the referenced ID. `organization_settings` demonstrates this
boundary with a composite foreign key to `(organization_id, membership_id)`: a membership from a
different organization cannot be recorded as the settings actor even when its UUID is known.

Roles are limited to `owner`, `admin` and `sales_manager`; agent delegation is owned by DOTS-010.
Row-level security, request-scoped database roles and adversarial cross-tenant query coverage are
owned by DOTS-011. Until those units merge, application code must not expose these tables directly
to an untrusted client or treat the current schema as a complete authorization system.


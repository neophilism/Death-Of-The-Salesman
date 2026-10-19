# Tenant and membership domain

Organizations, owner identities, memberships and versioned organization settings live in the
`app` schema. All records use database-generated UUID ownership keys and `timestamptz` instants.
Organization slugs and external identity subjects are unique stable identifiers; mutable display
names are not identity keys.

A user can hold memberships in more than one organization, but every organization-owned reference
must carry the organization ID with the referenced ID. `organization_settings` demonstrates this
boundary with a composite foreign key to `(organization_id, membership_id)`: a membership from a
different organization cannot be recorded as the settings actor even when its UUID is known.

Roles are limited to `owner`, `admin` and `sales_manager`; agent delegations remain constrained
to the non-owner scopes defined by DOTS-010.

DOTS-011 adds forced PostgreSQL row-level security to organizations, memberships, settings,
authentication policy, sessions and delegation grants. Shared owner identities and their external
identity records are visible only through a membership in the current organization. A non-superuser
request connection must set `app.organization_id` from the verified authorization context inside
the transaction; an unset context sees no tenant rows. The database rejects foreign-organization
reads, ID guesses, joins, inserts and updates, while application authorization remains responsible
for endpoint, role and resource-filter decisions within the selected tenant.


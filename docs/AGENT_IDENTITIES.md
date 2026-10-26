# Agent identities and approved names

DOTS-020 persists tenant-owned agent identities against the canonical 264-name approved roster.
Roster entries are character-name labels only; they do not grant actor likeness, image, or publicity rights.
Avatars must remain original or separately rights-cleared.

## Creation contract

- The database holds one immutable global row for every name in `registry/approved-salesman-names.json`; tenant identities reference those rows.
- Creates, lists, edits, and opt-in demo seeding require an active owner membership from the same organization and execute with tenant row security.
- Unknown names fail before a write. One organization cannot instantiate the same approved roster entry twice.
- Edits require the exact active identity version. Archived, stale, missing, cross-tenant, inactive-owner, and non-owner writes fail with the same non-enumerating result.
- New identities are inactive. Creating an identity does not create a worker, assignment, campaign, provider configuration, paid call, avatar license, or outbound authority.

## Demo and commercial defaults

Commercial organizations start with zero agent identities. `seedPrivateDemo` performs no query or write unless the caller explicitly sets `privateDemo: true`. The opt-in operation is idempotent and creates only the first two approved identities, displayed as Fast Eddie Felson and Harry Wormwood, both inactive. Repeating it does not duplicate them.

# Database migrations and transactions

DOTS-007 provides ordered reversible migrations in `database/migrations`, a fail-closed `psql`
runner, UUID and UTC timestamp helpers, and a small driver-neutral transaction wrapper.

Use only a disposable local PostgreSQL database during development:

```sh
createdb dots_development
DATABASE_URL=postgresql:///dots_development pnpm db:migrate
DATABASE_URL=postgresql:///dots_development pnpm db:rollback
```

The runner requires `DATABASE_URL`, passes it directly to `psql` without a shell, disables user
psql configuration, enables `ON_ERROR_STOP`, and wraps each migration in a transaction. Applying
an existing migration is idempotent. Rollback is limited to the latest migration and fails closed
otherwise. The metadata table records an independently generated UUID and `timestamptz` instant.

Migration files are immutable after merge. Add a higher numbered up/down pair for every schema
change. Never point local commands or CI at production, and never place a credential-bearing URL
in source, shell history, logs or documentation.

DOTS-011 enables and forces row-level security on tenant-owned records and on shared owner identity
records through visible memberships. Non-superuser application connections must set
`app.organization_id` from the authenticated, authorized request at transaction start and must
reset or discard that connection before reuse. Never accept that value from an untrusted request,
and never run application traffic as a superuser, table owner, or role with `BYPASSRLS`.
Migration and break-glass roles intentionally remain outside the application connection pool.


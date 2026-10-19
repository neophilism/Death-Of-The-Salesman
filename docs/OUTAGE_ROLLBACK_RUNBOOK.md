# Outage and rollback runbook

This is the repository-level response for a failed release or local/staging outage. It does not
grant production access. Only an authorized operator may act on a real environment.

## Stabilize first

1. Stop new worker and dispatch intake. Keep model and email adapters disabled unless an authorized
   incident owner explicitly preserves them.
2. Set or retain the paid-spend limit at zero. Do not send outreach, move money, submit grants, or
   make investor representations during an incident.
3. Record the environment, release commit, UTC start time, affected tenant boundary, symptoms, and
   correlation IDs. Do not copy credentials, message bodies, contacts, or other sensitive data.
4. Check the web `/api/health` and standalone API `/health` separately. A healthy route is not proof
   that the database, worker, storage, or external provider is healthy.

## Choose recovery, code rollback, or data rollback

| Condition | Action |
|---|---|
| Process/configuration failure with compatible schema | Restore the last known-good release and safe configuration; keep adapters disabled |
| Forward code fix is small and state remains valid | Prefer a reviewed forward fix with the normal CI gate |
| Latest migration is faulty and its down migration is proven lossless for current data | Stop writers, back up through an authorized process, then roll back exactly one migration |
| Migration rollback could discard or reinterpret data | Do not run `db:rollback`; create a corrective forward migration and obtain review |
| Tenant isolation, authentication, or artifact integrity may be compromised | Keep service unavailable, preserve non-sensitive evidence, and escalate to the security owner |

Never manually edit `app_meta.schema_migrations`, reuse an application connection as a migration
role, or point a local command at production. `pnpm db:rollback` reverts only the latest recorded
migration and intentionally fails closed when the local definition is missing or no longer latest.

## Verification after recovery

1. Run the exact release's `pnpm check` and relevant PostgreSQL acceptance.
2. Confirm safe runtime configuration loads with model and email delivery disabled and zero spend.
3. Confirm authentication and tenant-isolation negative tests when those boundaries were involved.
4. Confirm artifact metadata/digests when storage was involved; do not treat health checks as an
   integrity scan.
5. Restore traffic or workers gradually only under the environment's existing authorization. Real
   sends and paid calls remain separately gated.
6. Record the chosen action, verification evidence, residual risk, and follow-up owner in the
   incident record. Open a corrective PR for every repository change.

## Abandon rollback when unsafe

Stop and escalate when the release commit is unknown, evidence is incomplete, the affected tenant
set cannot be bounded, the migration down path is destructive, or required credentials/authority
are unavailable. Extended downtime is preferable to fabricated recovery evidence or an unsafe data
operation.

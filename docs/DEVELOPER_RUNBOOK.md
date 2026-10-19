# Developer runbook

This runbook is the zero-credential path for developing and reviewing the application. It does
not authorize paid services, outbound messages, production access, or provider calls.

## Prerequisites

- Node.js 22 or newer and Corepack
- pnpm 11.25.0, selected from the repository `packageManager` field
- Git
- PostgreSQL and `psql` only when exercising migrations or database acceptance

## Zero-credential demo setup

From a clean checkout:

```sh
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm check
pnpm dev
```

Open `http://localhost:3000` and verify `http://localhost:3000/api/health`. The copied environment
keeps `PAID_SPEND_LIMIT_CENTS=0`, `MODEL_API_ENABLED=false`, and
`EMAIL_DELIVERY_ENABLED=false`. Do not add model, email, cloud-storage, or production credentials
for local demo work.

The current synthetic preview is a deterministic domain fixture, not a live worker or campaign.
Verify it without a database, network provider, or account:

```sh
node --test tests/synthetic-preview.test.mjs
```

Synthetic records are visibly labeled, messages remain drafts, agents remain inactive, and spend
remains zero. Later UI work may render these fixtures but must preserve those properties.

## Daily commands

| Purpose | Command | External effect |
|---|---|---|
| Full source gate | `pnpm check` | None; no paid calls or sends |
| Dependency review | `pnpm audit:dependencies` | Reads the package advisory service |
| Web console | `pnpm dev` | Listens locally on port 3000 |
| Standalone API | `pnpm start:api` | Listens on `127.0.0.1:3001` |
| Worker boundary | `pnpm start:worker` | Reports disabled; performs no work |
| Apply migrations | `DATABASE_URL=... pnpm db:migrate` | Mutates only the named database |
| Roll back latest migration | `DATABASE_URL=... pnpm db:rollback` | Reverts one migration in the named database |

Use only a disposable local database. Never place a credential-bearing URL in source, command
examples, shell history, logs, screenshots, or issue text.

## Configuration and secret names

`.env.example` is the complete source for currently supported environment-variable names. Values
marked as credentials must be supplied outside source control. A credential alone never enables an
adapter.

| Name | Secret | Safe local value or rule | Owner |
|---|---:|---|---|
| `APP_ENV` | No | `development` | Application platform |
| `PAID_SPEND_LIMIT_CENTS` | No | `0` | Budget control plane |
| `MODEL_API_ENABLED` | No | `false` | Model execution |
| `MODEL_API_KEY` | Yes | Unset | Model execution |
| `EMAIL_DELIVERY_ENABLED` | No | `false` | Communications |
| `EMAIL_DELIVERY_TOKEN` | Yes | Unset | Communications |
| `OWNER_SPEND_AUTHORIZATION_ID` | No | Unset at zero spend | Owner authorization/audit |
| `DATABASE_URL` | Yes when credential-bearing | Disposable local database only | Database platform |
| `API_PORT` | No | `3001` | API platform |
| `NODE_ENV` | No | Tool-managed | Application platform |

Adding a name requires updates to `.env.example`, `docs/CONFIGURATION.md`, typed configuration,
negative tests, and this table in the same change. Never document a real value.

## Change ownership

- Transport contract changes follow `docs/adr/0001-versioned-contract-evolution.md` and
  `docs/DOMAIN_CONTRACTS.md`.
- HTTP routes follow `docs/adr/0002-endpoint-ownership.md`. The web package owns
  `/api/health`; the API package owns `/health`.
- Schema changes follow `docs/DATABASE.md`: add an immutable, ordered up/down pair and test a clean
  apply, rollback, and reapply.
- Runtime incidents and rollback decisions follow `docs/OUTAGE_ROLLBACK_RUNBOOK.md`.

## Before opening a pull request

Run `pnpm check` and, when dependencies changed, `pnpm audit:dependencies`. Exercise PostgreSQL
acceptance for migration changes. Record commands and outcomes, migration/rollback impact, secret
names only, spend impact, and security effects in the pull request. Do not claim deployment or live
integration evidence from local or mocked results.

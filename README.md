# Death Of The Salesman

An API-native, multi-model, **visual-first sales and fundraising command center**. This repository contains an offline application shell plus the approved architecture and development plan. The full application, real-world integrations and deployment are **not yet implemented or verified**.

## Start here

- [Full technical architecture](docs/TECHNICAL_ARCHITECTURE.md) — product boundaries, runtime, model routing, security, campaign controls, privacy and scaling.
- [Responsive product interaction design](docs/PRODUCT_INTERACTION_DESIGN.md) — dark dashboard, avatars, drag-and-drop project buckets, Strategy Lab, CRM and Conversation Center. **No random corner salesman quote.**
- [Complete development plan](docs/DEVELOPMENT_PLAN.md) — all phases and acceptance gates. Generated from one canonical plan.
- [Canonical machine-readable PR registry](registry/prs.json) — real PR mapping and dependency DAG, compatible with Boardroom's v1 contract.
- [Development-agent instructions](AGENTS.md) — implementation and checkpoint discipline.
- [Approved salesman names](registry/approved-salesman-names.json) — 264 owner-approved character names, starting with **Fast Eddie Felson** and **Harry Wormwood**.
- [Six model candidates](registry/model-catalog.json) — OpenAI, Claude, Grok, MiMo, GLM, Kimi; disabled until credentials and funding are provided.

## Development validation

```sh
node scripts/validate-pr-registry.mjs
node --test tests/registry.test.mjs
```

The roadmap CI is dependency-free and does not call paid APIs, send messages or start inference servers. Application build/start tests are available locally below; CI integration, security scans, E2E and deployment checks are later work.

## Operating guardrails

**No paid model, GPU, data-service, or outbound campaign spending is enabled by default.** Live email and model calls require owner-provided credentials, explicit budgets, campaign policies and consent/anti-spam controls. Downloadable open-weight checkpoint files belong in separately approved inference storage, not Git history.

Vision Agents are outside this application's scope. This product is architecturally independent from Boardroom, although both can later exchange scoped portfolio and verified operational summaries.


## Local application shell (DOTS-003)

Use Node 22 or newer and npm. No external accounts, database, model keys or environment file are required. The UI contains truthful empty states; authentication, persistent data, providers, outbound sending and real agent execution are not implemented yet.

```sh
npm ci
npm run check
npm start
```

`npm run check` runs strict type checks, the production builds for all workspaces, application/registry tests (including startup and shutdown), and roadmap validation. The build uses no remote fonts, model calls or account credentials. `npm start` opens the web shell at http://127.0.0.1:3000 and the narrow health-only API at http://127.0.0.1:3001/health. Both listen only on loopback. Stop with Ctrl+C; the runner stops both children and exits if either fails. Optional `WEB_PORT` and `API_PORT` overrides are integer ports; no external connectivity is enabled by changing them. Use dedicated processes and deployment configuration for later hosted environments rather than exposing this local shell.

For live UI editing after an initial build, run `npm run dev`. Independent commands are `npm run start:web`, `npm run start:api` (`PORT`, default 3001), and `npm run start:worker`. The worker prints its explicit inactive/offline state and exits because no queue or dispatch is implemented. `npm run typecheck` checks all three workspaces. Node service code compiles into each workspace's ignored `dist/`; Next.js outputs to ignored `.next/`.

`apps/web` is Next.js/React, `apps/api` is the separate TypeScript health server, and `apps/worker` is the separate TypeScript worker entry point. All extend `tsconfig.base.json` with strict checking enabled. Package versions and integrity hashes are pinned in the npm lockfile. CI quality/security expansion is separately planned under DOTS-004; the current roadmap workflow alone does not prove the application build or tests passed.

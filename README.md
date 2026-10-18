# Death Of The Salesman

An API-native, multi-model, **visual-first sales and fundraising command center**. This repository is at the architectural/planning stage; the application and its real-world integrations have **not yet been implemented, deployed or verified**.

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

The roadmap CI is dependency-free and does not call paid APIs, send messages or start inference servers. Later application development will add full build, tests, security scans, E2E and deployment checks.

## Operating guardrails

**No paid model, GPU, data-service, or outbound campaign spending is enabled by default.** Live email and model calls require owner-provided credentials, explicit budgets, campaign policies and consent/anti-spam controls. Downloadable open-weight checkpoint files belong in separately approved inference storage, not Git history.

Vision Agents are outside this application's scope. This product is architecturally independent from Boardroom, although both can later exchange scoped portfolio and verified operational summaries.

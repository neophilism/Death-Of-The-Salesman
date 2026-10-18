# DOTS-003: offline application foundation

Date: 2026-10-18. This implements the application shell only, not the sales or funding workflows.

## Boundaries

The npm monorepo contains three independent workspaces: Next.js App Router/React web, Node HTTP API, and a worker entry point. TypeScript strict mode, unchecked-index checking and exact optional-property checking are inherited from a common base. Packages and lockfile integrity hashes are pinned. The web app uses local CSS/system fonts so build and rendering need no remote font account or service. The build bounds Next.js worker concurrency to one CPU for reproducible operation in constrained environments.

The API exposes only GET /health, with no-store JSON and an explicit offline/integrations-disabled status. All other methods and routes return 404. This is a liveness signal, not a claim of database, provider, worker or product readiness. It binds to loopback. The worker reports inactive/offline and terminates without scheduling work, opening a queue or contacting providers. Environment validation and integration contracts remain DOTS-005/006 scope.

The web page renders explicit unavailable/empty states. It has no fabricated KPI totals, working-agent lights, editable controls with no persistence, character imagery or decorative quotations. Real presence, navigation, tokens, data, authentication, authorization and workflows remain their separately approved units. The shell is not safe or ready to expose as a production owner dashboard.

The local runner starts web/API as direct Node children, stops the sibling if either process fails, and forwards shutdown signals with bounded forced termination. The worker is intentionally invoked separately since a no-work worker should not stay alive just to appear active. Use separate managed processes for eventual deployment.

## Verification

A clean local install from the committed lockfile is followed by npm run check. The check performs each workspace typecheck and production build, API health/404 coverage, port validation, explicit worker offline behavior, canonical registry tests/validation and a startup integration test. The startup test supplies an environment allowlist without account credentials, serves actual built web/API output, checks truthful shell content, and proves both exact ports can be rebound after shutdown. npm run check does not make model calls or outbound sends.

Browser screenshot/keyboard checks were attempted but unavailable in the verification runtime because Playwright had no Chromium executable. No browser layout, accessibility audit or deployment success is claimed. Those remain unverified; CSS provides a responsive shell and a skip link for later browser verification.

The existing GitHub workflow validates the roadmap only. Local build/start evidence must not be represented as current-head GitHub application CI; expansion of CI is DOTS-004. No protected workflow changes are bundled here. No owner credentials or new spending are required for this unit. Rollback reverts the shell source and npm manifests; there are no migrations or live resources.

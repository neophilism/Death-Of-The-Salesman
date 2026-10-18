# Local development

The foundation requires Node.js 22 or newer and Corepack/pnpm. It starts without credentials, external
accounts, a database, model calls, outbound messages, or paid resources.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm build
pnpm dev
```

The web console is available at `http://localhost:3000`. Its health route is `/api/health`.
The standalone API can be built with the root build and started with `pnpm start:api`; it binds
only to `127.0.0.1:3001` by default and exposes `/health`. `npm run start:worker` confirms the
separate worker boundary while remaining disabled. Later plan units own configuration, database,
authentication, domain contracts, queues, and production deployment.

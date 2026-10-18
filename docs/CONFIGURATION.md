# Runtime configuration

The typed `@dots/config` package accepts four exact environments: `development`,
`test`, `staging`, and `production`. The default is `development`.

All paid-capable adapters are disabled and the spend limit is zero by default. Merely
providing a credential does not enable an adapter. Enabling model API or email delivery
requires all three of:

- the adapter's exact `*_ENABLED=true` flag;
- its credential, supplied outside source control; and
- a positive integer-cent `PAID_SPEND_LIMIT_CENTS` plus the nonsecret
  `OWNER_SPEND_AUTHORIZATION_ID` approval reference.

Malformed booleans, malformed spend limits, missing enabled-adapter credentials, and
unauthorized production spend fail during configuration loading. These checks do not
authorize a provider call or outbound message; later plan units add the server-side
budget, policy, consent, and dispatch gates.

Use `.env.example` for names and safe defaults. Never commit a populated `.env` file.

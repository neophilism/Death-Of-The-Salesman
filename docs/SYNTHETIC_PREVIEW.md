# Synthetic preview fixtures

`createSyntheticPreview(seed, guard)` produces a deterministic in-memory account for screenshots,
demos and tests. Every preview carries the visible label `Synthetic`; contacts are suppressed,
messages remain drafts, agents are inactive, usage is zero and all canonical envelopes pass the
domain contract parser. The same normalized seed always produces the same identifiers and data.

Preview creation rejects enabled model inference, enabled email delivery or any nonzero paid-spend
limit. The fixture module has no network, provider, queue, credential or persistence adapter and
cannot send a message or call metered inference. Callers must keep the `Synthetic` label visible
when rendering this data and must not mix preview records with production accounts.

Use a bounded, non-sensitive seed:

```ts
const preview = createSyntheticPreview("homepage-screenshot", {
  modelApiEnabled: false,
  emailDeliveryEnabled: false,
  paidSpendLimitCents: 0,
});
```

The fixtures intentionally model only deterministic preview state. Live-provider behavior,
deliverability, real outcomes and production readiness require separate evidence.

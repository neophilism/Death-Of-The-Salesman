import assert from "node:assert/strict";
import test from "node:test";
import { loadRuntimeConfiguration } from "../packages/config/dist/index.js";

test("configuration defaults to development with every paid capability disabled", () => {
  const config = loadRuntimeConfiguration({});
  assert.equal(config.environment, "development");
  assert.equal(config.paidSpendLimitCents, 0);
  assert.deepEqual(config.modelApi, { enabled: false, credential: undefined });
  assert.deepEqual(config.emailDelivery, { enabled: false, credential: undefined });
});

test("all four deployment environments are distinct and accepted", () => {
  for (const environment of ["development", "test", "staging", "production"]) {
    assert.equal(loadRuntimeConfiguration({ APP_ENV: environment }).environment, environment);
  }
});

test("optional credentials never enable adapters", () => {
  const config = loadRuntimeConfiguration({
    MODEL_API_KEY: "test-model-key",
    EMAIL_DELIVERY_TOKEN: "test-email-token",
  });
  assert.equal(config.modelApi.enabled, false);
  assert.equal(config.emailDelivery.enabled, false);
  assert.equal(config.paidSpendLimitCents, 0);
});

test("malformed and unsafe settings fail closed", () => {
  assert.throws(() => loadRuntimeConfiguration({ APP_ENV: "prod" }), /APP_ENV/);
  assert.throws(() => loadRuntimeConfiguration({ MODEL_API_ENABLED: "yes" }), /exactly/);
  assert.throws(() => loadRuntimeConfiguration({ PAID_SPEND_LIMIT_CENTS: "-1" }), /non-negative/);
  assert.throws(
    () => loadRuntimeConfiguration({ MODEL_API_ENABLED: "true" }),
    /without its credential/,
  );
  assert.throws(
    () =>
      loadRuntimeConfiguration({
        MODEL_API_ENABLED: "true",
        MODEL_API_KEY: "test-model-key",
      }),
    /paid spend remains disabled/,
  );
  assert.throws(
    () =>
      loadRuntimeConfiguration({
        APP_ENV: "production",
        PAID_SPEND_LIMIT_CENTS: "100",
      }),
    /production spend requires/,
  );
});

test("an adapter requires an explicit bounded owner authorization", () => {
  const config = loadRuntimeConfiguration({
    APP_ENV: "staging",
    MODEL_API_ENABLED: "true",
    MODEL_API_KEY: "test-model-key",
    PAID_SPEND_LIMIT_CENTS: "250",
    OWNER_SPEND_AUTHORIZATION_ID: "approval-123",
  });
  assert.equal(config.modelApi.enabled, true);
  assert.equal(config.paidSpendLimitCents, 250);
  assert.equal(config.ownerSpendAuthorizationId, "approval-123");
});

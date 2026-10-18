import assert from "node:assert/strict";
import test from "node:test";

test("intentional CI contract failure", () => {
  assert.fail("This fixture must only run through scripts/verify-test-failure.mjs");
});

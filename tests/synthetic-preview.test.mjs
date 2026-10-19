import assert from "node:assert/strict";
import test from "node:test";
import {
  createSyntheticPreview,
  parseContract,
} from "../packages/domain/dist/index.js";

test("synthetic previews are deterministic, labeled, and contract-valid", () => {
  const first = createSyntheticPreview("screenshot-one");
  const repeat = createSyntheticPreview("screenshot-one");
  const other = createSyntheticPreview("screenshot-two");

  assert.deepEqual(first, repeat);
  assert.notEqual(first.account.organizationId, other.account.organizationId);
  assert.equal(first.mode, "synthetic");
  assert.equal(first.label, "Synthetic");
  assert.ok(first.contracts.every((contract) => parseContract(contract)));
  assert.ok(first.threads.every((thread) => thread.label === "Synthetic"));
  assert.ok(first.threads.every((thread) => thread.messages.every((message) => message.status === "draft")));
});

test("preview data cannot represent outbound delivery, metered inference, or spend", () => {
  const preview = createSyntheticPreview();
  assert.deepEqual(preview.safety, {
    outboundDeliveryEnabled: false,
    meteredInferenceEnabled: false,
    paidSpendLimitCents: 0,
  });
  assert.ok(preview.metrics.every((metric) => metric.synthetic));
  assert.equal(preview.metrics.find((metric) => metric.label === "Drafts sent")?.value, 0);
  assert.equal(preview.metrics.find((metric) => metric.label === "Metered requests")?.value, 0);
  assert.ok(
    preview.contracts
      .filter((contract) => contract.kind === "contact")
      .every((contract) => contract.data.status === "suppressed"),
  );
  assert.throws(
    () => createSyntheticPreview("unsafe-model", { modelApiEnabled: true }),
    /requires disabled delivery/,
  );
  assert.throws(
    () => createSyntheticPreview("unsafe-email", { emailDeliveryEnabled: true }),
    /requires disabled delivery/,
  );
  assert.throws(
    () => createSyntheticPreview("unsafe-spend", { paidSpendLimitCents: 1 }),
    /requires disabled delivery/,
  );
});

test("preview seeds are bounded and contain no user-supplied display data", () => {
  assert.equal(createSyntheticPreview("  DEMO-42  ").seed, "demo-42");
  assert.throws(() => createSyntheticPreview("../production"), /seed must contain/);
  assert.throws(() => createSyntheticPreview(""), /seed must contain/);
});

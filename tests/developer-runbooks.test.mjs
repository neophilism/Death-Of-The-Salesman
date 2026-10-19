import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("zero-credential developer path preserves safe defaults", async () => {
  const [runbook, example] = await Promise.all([
    read("../docs/DEVELOPER_RUNBOOK.md"),
    read("../.env.example"),
  ]);

  for (const command of ["pnpm install --frozen-lockfile", "pnpm check", "pnpm dev"]) {
    assert.match(runbook, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const safeDefault of [
    "PAID_SPEND_LIMIT_CENTS=0",
    "MODEL_API_ENABLED=false",
    "EMAIL_DELIVERY_ENABLED=false",
  ]) {
    assert.match(example, new RegExp(safeDefault));
    assert.match(runbook, new RegExp(safeDefault));
  }
  assert.match(runbook, /without a database, network provider, or account/);
});

test("operational documentation assigns ownership and fail-closed rollback", async () => {
  const [runbook, outage, contracts, endpoints] = await Promise.all([
    read("../docs/DEVELOPER_RUNBOOK.md"),
    read("../docs/OUTAGE_ROLLBACK_RUNBOOK.md"),
    read("../docs/adr/0001-versioned-contract-evolution.md"),
    read("../docs/adr/0002-endpoint-ownership.md"),
  ]);

  for (const name of [
    "MODEL_API_KEY",
    "EMAIL_DELIVERY_TOKEN",
    "OWNER_SPEND_AUTHORIZATION_ID",
    "DATABASE_URL",
  ]) assert.match(runbook, new RegExp(`\\b${name}\\b`));

  assert.match(outage, /Do not run `db:rollback`/);
  assert.match(outage, /Stop and escalate/);
  assert.match(contracts, /Unknown fields, unknown kinds, and unsupported versions\nfail closed/);
  assert.match(contracts, /Schema versions do not grant authorization/);
  assert.match(endpoints, /web package owns[\s\S]*`\/api\/health`/);
  assert.match(endpoints, /API package owns[\s\S]*`\/health`/);
  assert.match(endpoints, /Health endpoints report only their own\nprocess boundary/);
});

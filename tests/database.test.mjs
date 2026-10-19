import assert from "node:assert/strict";
import test from "node:test";
import { newEntityId, toUtcTimestamp, withTransaction } from "../packages/database/dist/index.js";

test("entity IDs are valid unique UUIDs and timestamps are canonical UTC", () => {
  const first = newEntityId();
  const second = newEntityId();
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(first, second);
  assert.equal(toUtcTimestamp(new Date("2026-10-19T02:30:00+02:00")), "2026-10-19T00:30:00.000Z");
  assert.throws(() => toUtcTimestamp(new Date("invalid")), /valid date/);
});

test("transaction helper commits a successful operation", async () => {
  const statements = [];
  const client = { query: async (statement) => statements.push(statement) };
  const result = await withTransaction(client, async (transaction) => {
    await transaction.query("SELECT 1");
    return "done";
  });
  assert.equal(result, "done");
  assert.deepEqual(statements, ["BEGIN", "SELECT 1", "COMMIT"]);
});

test("transaction helper rolls back and preserves the operation error", async () => {
  const statements = [];
  const expected = new Error("write rejected");
  const client = { query: async (statement) => statements.push(statement) };
  await assert.rejects(
    withTransaction(client, async () => {
      throw expected;
    }),
    (error) => error === expected,
  );
  assert.deepEqual(statements, ["BEGIN", "ROLLBACK"]);
});

test("transaction helper reports an independent rollback failure", async () => {
  const client = {
    query: async (statement) => {
      if (statement === "ROLLBACK") throw new Error("connection lost");
    },
  };
  await assert.rejects(
    withTransaction(client, async () => {
      throw new Error("operation failed");
    }),
    (error) => error instanceof AggregateError && error.errors.length === 2,
  );
});


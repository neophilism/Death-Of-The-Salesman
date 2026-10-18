import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loadJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));

test("workspace exposes independently runnable web, API, and worker packages", async () => {
  const root = await loadJson("../package.json");
  assert.deepEqual(root.workspaces, ["apps/*", "packages/*"]);
  assert.ok(root.scripts.start);
  assert.ok(root.scripts["start:api"]);
  assert.ok(root.scripts["start:worker"]);
});

test("all paid-capable integrations are absent from the foundation shell", async () => {
  const root = await loadJson("../package.json");
  const dependencies = { ...root.dependencies, ...root.devDependencies };
  for (const prohibited of ["openai", "@anthropic-ai/sdk", "nodemailer", "stripe"]) {
    assert.equal(dependencies[prohibited], undefined);
  }
});

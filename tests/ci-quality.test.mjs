import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { findSecrets } from "../scripts/scan-secrets.mjs";

test("secret scan detects representative credentials without printing values", () => {
  const token = ["gh", "p_"].join("") + "a".repeat(32);
  assert.deepEqual(findSecrets("fixture", `TOKEN=${token}\n`), [
    { path: "fixture", line: 1, label: "GitHub token" },
  ]);
  assert.deepEqual(findSecrets("fixture", "TOKEN=disabled\n"), []);
});

test("the repository test runner propagates a deliberate failure", async () => {
  const directory = await mkdtemp(join(tmpdir(), "dots-ci-"));
  const fixture = join(directory, "deliberate-failure.test.mjs");
  try {
    await writeFile(
      fixture,
      'import test from "node:test";\nimport assert from "node:assert/strict";\ntest("fails",()=>assert.fail("expected"));\n',
    );
    const result = spawnSync(process.execPath, ["--test", fixture], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /fail/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("quality workflow runs every required gate without error suppression", async () => {
  const [workflow, packageText] = await Promise.all([
    readFile(new URL("../.github/workflows/quality.yml", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageText);
  for (const script of ["lint", "typecheck", "test", "build", "security:secrets"]) {
    assert.ok(packageJson.scripts[script], `missing ${script} script`);
  }
  assert.match(workflow, /run: pnpm check/);
  assert.match(workflow, /pnpm audit --prod --audit-level=high --json/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
  assert.match(workflow, /permissions:\n  contents: read/);
});

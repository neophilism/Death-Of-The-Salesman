import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["--test", "tests/fixtures/intentionally-failing.test.mjs"], {
  encoding: "utf8",
});

if (result.status === 0) {
  console.error("The test runner did not reject the intentionally failing fixture.");
  process.exit(1);
}
console.log("The test runner returns a blocking status for a failing test.");

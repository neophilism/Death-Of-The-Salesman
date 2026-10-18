import assert from "node:assert/strict";
import test from "node:test";
import { scanText } from "../scripts/scan-secrets.mjs";

test("secret scanner recognizes representative credential signatures", () => {
  const githubToken = ["ghp", "a".repeat(30)].join("_");
  const privateKey = ["-----BEGIN", "PRIVATE", "KEY-----"].join(" ");
  assert.deepEqual(scanText(githubToken), ["GitHub token"]);
  assert.deepEqual(scanText(privateKey), ["private key"]);
});

test("secret scanner ignores ordinary configuration text", () => {
  assert.deepEqual(scanText("PAID_SPEND_USD=0\nMODEL_PROVIDER=disabled"), []);
});

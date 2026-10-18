import { pathToFileURL } from "node:url";
import { listTextFiles, readTextFile } from "./files.mjs";

const signatures = [
  { name: "private key", pattern: new RegExp(["BEGIN", "(?:RSA |EC |OPENSSH )?PRIVATE", "KEY"].join("[ -]")) },
  { name: "GitHub token", pattern: /gh[pousr]_[A-Za-z0-9]{24,}/ },
  { name: "OpenAI-style key", pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/ },
];

export function scanText(source) {
  return signatures.filter(({ pattern }) => pattern.test(source)).map(({ name }) => name);
}

export async function scanRepository() {
  const findings = [];
  for (const file of await listTextFiles()) {
    if (file.endsWith("scripts/scan-secrets.mjs") || file.endsWith("tests/security-tools.test.mjs")) continue;
    for (const name of scanText(await readTextFile(file))) findings.push(`${file}: ${name}`);
  }
  return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = await scanRepository();
  if (findings.length) {
    console.error(findings.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Secret signature scan passed.");
  }
}

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const detectors = () => [
  {
    label: "private key",
    pattern: new RegExp(["-----BEGIN ", "(?:RSA |EC |OPENSSH )?", "PRIVATE KEY-----"].join(""), "g"),
  },
  {
    label: "GitHub token",
    pattern: new RegExp("\\b" + ["gh", "p_"].join("") + "[A-Za-z0-9]{30,}\\b", "g"),
  },
  {
    label: "AWS access key",
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
  },
  {
    label: "Stripe secret key",
    pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
  },
  {
    label: "Slack token",
    pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g,
  },
];

export const findSecrets = (path, content) => {
  const findings = [];
  for (const detector of detectors()) {
    for (const match of content.matchAll(detector.pattern)) {
      const line = content.slice(0, match.index).split("\n").length;
      findings.push({ path, line, label: detector.label });
    }
  }
  return findings;
};

export const scanTrackedFiles = () => {
  const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
    .split("\0")
    .filter(Boolean);
  return tracked.flatMap((path) => {
    const content = readFileSync(path, "utf8");
    return content.includes("\0") ? [] : findSecrets(path, content);
  });
};

const run = () => {
  const findings = scanTrackedFiles();
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.path}:${finding.line}: possible ${finding.label}`);
    }
    process.exitCode = 1;
    return;
  }
  console.log("Secret scan passed for tracked text files.");
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run();
}

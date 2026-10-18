import path from "node:path";
import { listTextFiles, readTextFile } from "./files.mjs";

const failures = [];
for (const file of await listTextFiles()) {
  const source = await readTextFile(file);
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (/[ \t]+$/.test(line)) failures.push(`${file}:${index + 1}: trailing whitespace`);
    if (line.includes("\t")) failures.push(`${file}:${index + 1}: tab character`);
  });
  if (path.extname(file) === ".json") {
    try { JSON.parse(source); }
    catch (error) { failures.push(`${file}: invalid JSON: ${error.message}`); }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Static repository lint passed.");
}

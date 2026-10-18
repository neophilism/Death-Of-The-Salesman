import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ignoredDirectories = new Set([".git", ".next", "coverage", "dist", "node_modules"]);
const textExtensions = new Set([
  ".css", ".json", ".js", ".jsx", ".md", ".mjs", ".ts", ".tsx", ".yaml", ".yml",
]);

export async function listTextFiles(directory = ".") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory() && !ignoredDirectories.has(entry.name)) {
      files.push(...await listTextFiles(candidate));
    } else if (entry.isFile() && (entry.name.startsWith(".") || textExtensions.has(path.extname(entry.name)))) {
      files.push(candidate);
    }
  }
  return files;
}

export async function readTextFile(file) {
  return readFile(file, "utf8");
}

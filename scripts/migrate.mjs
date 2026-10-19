import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationsDirectory = join(root, "database", "migrations");
const direction = process.argv[2] ?? "up";
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) throw new Error("DATABASE_URL is required");
if (direction !== "up" && direction !== "down") throw new Error("direction must be up or down");

const names = (await readdir(migrationsDirectory))
  .filter((name) => /^\d{4}_[a-z0-9_]+\.up\.sql$/.test(name))
  .map((name) => name.slice(0, -"\.up.sql".length))
  .sort();

if (names.length === 0) throw new Error("no migrations found");
if (new Set(names).size !== names.length) throw new Error("duplicate migration versions");

const run = (sql, capture = false) => {
  const args = [databaseUrl, "-X", "--no-psqlrc", "--set", "ON_ERROR_STOP=1"];
  if (capture) args.push("--tuples-only", "--no-align");

  const result = spawnSync("psql", args, {
    encoding: "utf8",
    input: sql,
    stdio: capture ? ["pipe", "pipe", "inherit"] : ["pipe", "inherit", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`psql exited with status ${result.status}`);
  return capture ? result.stdout.trim() : "";
};

const bootstrap = `
CREATE SCHEMA IF NOT EXISTS app_meta;
CREATE TABLE IF NOT EXISTS app_meta.schema_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE CHECK (version ~ '^[0-9]{4}_[a-z0-9_]+$'),
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

if (direction === "up") {
  for (const version of names) {
    const body = await readFile(join(migrationsDirectory, `${version}.up.sql`), "utf8");
    run(`
BEGIN;
${bootstrap}
SELECT NOT EXISTS (
  SELECT 1 FROM app_meta.schema_migrations WHERE version = '${version}'
) AS should_apply \\gset
\\if :should_apply
${body}
INSERT INTO app_meta.schema_migrations(version) VALUES ('${version}');
\\else
\\echo '${version} already applied'
\\endif
COMMIT;
`);
  }
} else {
  run(bootstrap);
  const version = run(
    "SELECT version FROM app_meta.schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1;",
    true,
  );
  if (!version) throw new Error("no applied migration available to roll back");
  if (!names.includes(version)) {
    throw new Error(`latest applied migration ${version} has no local definition`);
  }

  const body = await readFile(join(migrationsDirectory, `${version}.down.sql`), "utf8");
  run(`
BEGIN;
LOCK TABLE app_meta.schema_migrations IN EXCLUSIVE MODE;
SELECT COALESCE(
  (SELECT version = '${version}' FROM app_meta.schema_migrations ORDER BY applied_at DESC, version DESC LIMIT 1),
  false
) AS should_revert \\gset
\\if :should_revert
${body}
DELETE FROM app_meta.schema_migrations WHERE version = '${version}';
\\else
\\echo '${version} is no longer the latest applied migration'
\\quit
\\endif
COMMIT;
`);
}

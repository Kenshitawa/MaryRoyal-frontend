import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const env = { ...process.env };
delete env.FORCE_COLOR;
delete env.NO_COLOR;
env.DATABASE_URL = "file:./round3-e2e.test.db";
env.MARY_E2E = "1";
env.NODE_ENV = "test";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const win = process.platform === "win32";
const testDatabasePath = resolve(root, "prisma/round3-e2e.test.db");
for (const suffix of ["", "-journal", "-wal", "-shm"]) {
  fs.rmSync(`${testDatabasePath}${suffix}`, { force: true });
}
fs.closeSync(fs.openSync(testDatabasePath, "a"));

const run = (cmdStr) =>
  win
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", cmdStr], { cwd: root, env, stdio: "inherit" })
    : spawnSync("sh", ["-c", cmdStr], { cwd: root, env, stdio: "inherit" });

// Always prepare only the isolated local E2E database.
const schemaReady = run("npx prisma db push --schema prisma/schema.prisma --skip-generate");
if (schemaReady.status !== 0) process.exit(schemaReady.status ?? 1);

// 1. Seed demo database
const seeded = run("npm run seed:demo");
if (seeded.status !== 0) process.exit(seeded.status ?? 1);

// Playwright's guarded global setup generates fresh role storage states.
// 2. Run Playwright with passed arguments (or all tests)
const extraArgs = process.argv.slice(2).join(" ");
const playwrightCmd = extraArgs ? `npx playwright test ${extraArgs}` : "npx playwright test";
const result = run(playwrightCmd);

process.exit(result.status ?? 1);

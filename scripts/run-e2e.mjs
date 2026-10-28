import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const env = { ...process.env };
delete env.FORCE_COLOR;
delete env.NO_COLOR;
env.DATABASE_URL = "file:./round3-e2e.test.db";
env.MARY_E2E = "1";
env.NODE_ENV = "production";
env.NEXT_DIST_DIR = ".next-e2e";
env.PORT = "3187";

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
const clientReady = run("npx prisma generate --schema prisma/schema.prisma");
if (clientReady.status !== 0) process.exit(clientReady.status ?? 1);

const schemaReady = run("npx prisma db push --schema prisma/schema.prisma --skip-generate");
if (schemaReady.status !== 0) process.exit(schemaReady.status ?? 1);

// 1. Seed demo database
const seeded = run("npm run seed:demo");
if (seeded.status !== 0) process.exit(seeded.status ?? 1);

const sessionsReady = run("npx tsx scripts/generate-test-sessions.ts");
if (sessionsReady.status !== 0) process.exit(sessionsReady.status ?? 1);

const appReady = run("npm run build:e2e");
if (appReady.status !== 0) process.exit(appReady.status ?? 1);

// 2. Run Playwright with passed arguments (or all tests)
const extraArgs = process.argv.slice(2).join(" ");
const playwrightCmd = extraArgs ? `npx playwright test ${extraArgs}` : "npx playwright test";
const collectMobileAudit = process.argv.length === 2 || process.argv.some((argument) => argument.includes("mobile-audit.spec.ts"));
if (collectMobileAudit) {
  const collectionPath = resolve(root, "test-results/mobile-failure-collection.jsonl");
  fs.mkdirSync(resolve(root, "test-results"), { recursive: true });
  fs.rmSync(collectionPath, { force: true });
}
const result = run(playwrightCmd);

if (collectMobileAudit) {
  const report = run("node scripts/write-mobile-failure-report.mjs");
  if (report.status !== 0) process.exit(report.status ?? 1);
}

process.exit(result.status ?? 1);

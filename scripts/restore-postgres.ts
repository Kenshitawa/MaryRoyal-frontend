import { createDecipheriv } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { PrismaClient } from "@prisma/client";
import { postgresEnvironment, safeEnvironment } from "./postgres-connection";

const magic = Buffer.from("MRSMSBK1");

async function main() {
  const backup = resolve(process.env.BACKUP_FILE ?? "");
  const connection = process.env.RESTORE_DATABASE_URL;
  if (!process.env.BACKUP_FILE || !connection) throw new Error("Set BACKUP_FILE and RESTORE_DATABASE_URL in the trusted restore environment.");
  if (process.env.RESTORE_CONFIRM !== "RESTORE_TO_EMPTY_DATABASE") throw new Error("Set RESTORE_CONFIRM=RESTORE_TO_EMPTY_DATABASE after verifying this is a separate empty database.");
  const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? "", "base64url");
  if (key.byteLength !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be a base64url-encoded 32-byte key.");
  const restoreUrl = new URL(connection);
  const productionUrl = process.env.DIRECT_URL ? new URL(process.env.DIRECT_URL) : null;
  if (productionUrl && restoreUrl.host === productionUrl.host && restoreUrl.pathname === productionUrl.pathname) throw new Error("Restore target matches the production connection. Use a separate empty database.");

  const size = (await stat(backup)).size;
  const headerSize = magic.length + 12;
  const tagSize = 16;
  if (size <= headerSize + tagSize) throw new Error("Encrypted backup is too small or invalid.");
  const handle = await open(backup, "r");
  const header = Buffer.alloc(headerSize);
  const tag = Buffer.alloc(tagSize);
  try {
    await handle.read(header, 0, headerSize, 0);
    await handle.read(tag, 0, tagSize, size - tagSize);
  } finally { await handle.close(); }
  if (!header.subarray(0, magic.length).equals(magic)) throw new Error("Backup format is invalid.");
  const nonce = header.subarray(magic.length, headerSize);

  const db = new PrismaClient({ datasourceUrl: connection });
  try {
    const tables = await db.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
    `;
    if (tables[0]?.count !== BigInt(0)) throw new Error("Restore target contains tables. Create a separate empty database first.");
  } finally { await db.$disconnect(); }

  const temp = await mkdtemp(join(tmpdir(), "mary-royal-restore-"));
  const archive = join(temp, "restore.pgdump");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(tag);
    await pipeline(createReadStream(backup, { start: headerSize, end: size - tagSize - 1 }), decipher, createWriteStream(archive, { flags: "wx" }));
    const pgEnvironment = postgresEnvironment(connection);
    const child = spawn(process.env.PG_RESTORE_PATH || "pg_restore", ["--dbname", pgEnvironment.PGDATABASE, "--exit-on-error", "--no-owner", "--no-acl"], {
      env: safeEnvironment(pgEnvironment), stdio: ["pipe", "ignore", "ignore"],
    });
    const exited = new Promise<number>((resolveExit, reject) => {
      child.once("error", () => reject(new Error("Could not start pg_restore. Install PostgreSQL client tools and retry.")));
      child.once("close", code => resolveExit(code ?? 1));
    });
    await pipeline(createReadStream(archive), child.stdin);
    if (await exited !== 0) throw new Error("pg_restore failed; check the empty test database and PostgreSQL client version.");
    console.log("Restore completed into the confirmed separate database. Verify counts and smoke-test login and a learner profile.");
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "PostgreSQL restore failed.");
  process.exitCode = 1;
});

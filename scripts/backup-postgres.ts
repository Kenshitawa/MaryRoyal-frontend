import { randomBytes, createCipheriv } from "node:crypto";
import { spawn } from "node:child_process";
import { appendFile, mkdir, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { resolve } from "node:path";
import { postgresEnvironment, safeEnvironment } from "./postgres-connection";

const magic = Buffer.from("MRSMSBK1");

async function main() {
  const connection = process.env.DIRECT_URL;
  if (!connection) throw new Error("Set DIRECT_URL to the direct PostgreSQL connection in the trusted environment.");
  const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY ?? "", "base64url");
  if (key.byteLength !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be a base64url-encoded 32-byte key.");
  const folder = resolve(process.env.BACKUP_DIR ?? "backups");
  await mkdir(folder, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-");
  const target = resolve(folder, `mary-royal-${stamp}.pgdump.enc`);
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const child = spawn(process.env.PG_DUMP_PATH || "pg_dump", ["--format=custom", "--no-owner", "--no-acl"], {
    env: safeEnvironment(postgresEnvironment(connection)), stdio: ["ignore", "pipe", "ignore"],
  });
  const exited = new Promise<number>((resolveExit, reject) => {
    child.once("error", () => reject(new Error("Could not start pg_dump. Install PostgreSQL client tools and retry.")));
    child.once("close", code => resolveExit(code ?? 1));
  });
  try {
    await writeFile(target, Buffer.concat([magic, nonce]), { flag: "wx" });
    await pipeline(child.stdout, cipher, createWriteStream(target, { flags: "a" }));
    if (await exited !== 0) throw new Error("pg_dump failed; the encrypted partial backup was removed.");
    await appendFile(target, cipher.getAuthTag());
    console.log(`Encrypted PostgreSQL backup created: ${target}`);
  } catch (error) {
    child.kill();
    await rm(target, { force: true });
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "PostgreSQL backup failed.");
  process.exitCode = 1;
});

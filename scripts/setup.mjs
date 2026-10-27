import { randomBytes } from "node:crypto";
import { cp, access, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
try { await access(envPath); } catch { await cp(resolve(root, ".env.example"), envPath); }
let envText = await readFile(envPath, "utf8");
if (envText.includes("replace-this-with-a-long-random-secret-at-least-32-chars")) {
 envText = envText.replace("replace-this-with-a-long-random-secret-at-least-32-chars", randomBytes(32).toString("base64url"));
 await writeFile(envPath, envText, "utf8");
 console.log("Generated a private 32-byte SESSION_SECRET in .env.");
}
process.env.RUST_LOG ??= "info";
for (const [command, args] of [["npm", ["install"]], ["npx", ["prisma", "db", "push"]], ["npx", ["tsx", "prisma/seed.ts"]]]) {
 const win = process.platform === "win32";
 const result = win ? spawnSync("cmd.exe", ["/d", "/s", "/c", `${command} ${args.join(" ")}`], { cwd: root, stdio: "inherit" }) : spawnSync(command, args, { cwd: root, stdio: "inherit" });
 if (result.status !== 0) process.exit(result.status ?? 1);
}

import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
async function main() {
 const root = process.cwd(); const source = resolve(root, "prisma/dev.db");
 if (!existsSync(source)) { console.error("No local database found. Run npm run setup first."); process.exitCode = 1; return; }
 const folder = resolve(root, "backups"); await mkdir(folder, { recursive: true });
 const stamp = new Date().toISOString().replaceAll(":", "-"); const dest = resolve(folder, `mary-royal-${stamp}.db`); await copyFile(source, dest); console.log(`Backup written to ${dest}`);
}
void main();

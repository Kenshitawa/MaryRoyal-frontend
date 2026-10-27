import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const patterns = {
  Supabase: /sb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}/g,
  "private key": /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  "PostgreSQL URI credentials": /postgres(?:ql)?:\/\/[^\s:'"<>]+:(?!\[YOUR-PASSWORD\])[^\s@'"<>]{10,}@/gi,
  "AWS access key": /\bAKIA[0-9A-Z]{16}\b/g,
  "GitHub token": /\b(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]{20,}\b/g,
};

const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
const history = execFileSync("git", ["log", "--all", "--format=", "--patch"], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
const findings = Object.fromEntries(Object.entries(patterns).map(([name, expression]) => {
  expression.lastIndex = 0;
  let count = 0;
  count += [...history.matchAll(expression)].length;
  for (const file of tracked) {
    let content;
    try { content = readFileSync(file, "utf8"); } catch { continue; }
    expression.lastIndex = 0;
    count += [...content.matchAll(expression)].length;
  }
  return [name, count];
}));

for (const [name, count] of Object.entries(findings)) console.log(`${name}: ${count} match(es)`);
if (Object.values(findings).some(count => count > 0)) process.exitCode = 1;

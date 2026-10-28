import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const collectionPath = path.join(root, "test-results/mobile-failure-collection.jsonl");
const expectedContexts = 20;
const rows = fs.existsSync(collectionPath)
  ? fs.readFileSync(collectionPath, "utf8").split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  : [];
const completed = rows.filter((row) => row.kind === "complete");
const records = rows.filter((row) => row.kind === "finding");
const groups = new Map();
for (const record of records) {
  const key = `${record.cause}\u0000${record.detail}`;
  const group = groups.get(key) ?? { cause: record.cause, detail: record.detail, contexts: [] };
  group.contexts.push(`${record.role} ${record.route} · ${record.width}px · ${record.mode}/${record.style}`);
  groups.set(key, group);
}
const byCause = new Map();
for (const group of groups.values()) byCause.set(group.cause, [...(byCause.get(group.cause) ?? []), group]);
const sections = [...byCause.entries()].sort((a, b) => b[1].reduce((n, g) => n + g.contexts.length, 0) - a[1].reduce((n, g) => n + g.contexts.length, 0)).map(([cause, items]) => {
  const count = items.reduce((total, item) => total + item.contexts.length, 0);
  const lines = items.map((item) => {
    const sample = item.contexts.slice(0, 6);
    const rest = item.contexts.length - sample.length;
    return `- **${item.contexts.length} occurrence${item.contexts.length === 1 ? "" : "s"}:** ${item.detail}\n  - ${sample.join("; ")}${rest > 0 ? `; …and ${rest} more` : ""}`;
  }).join("\n");
  return `## ${cause} — ${count} (${items.length} unique causes)\n\n${lines}`;
});
const complete = new Set(completed.map(row => `${row.role}:${row.width}`)).size === expectedContexts;
const routeCount = completed[0]?.routeCount;
const routeSummary = routeCount ? `${routeCount} inventoried route paths` : "inventoried index and detail route paths";
const summary = `**${complete ? "Complete" : `INCOMPLETE (${completed.length}/${expectedContexts} role and viewport collections)`} mobile audit.** Generated ${new Date().toISOString()}. It attempted all ${routeSummary} for each of ten roles at 360px and 390px; four mode/style appearances were measured for each authorized rendered route. Access-denied routes were attempted once per role and were not counted as rendered UI. The sole touch-target exception is an inline anchor within a prose paragraph with surrounding sentence text, as documented in docs/DECISIONS.md.\n\nTotal findings: **${records.length}** across ${byCause.size} distinct causes. Completed collections: **${completed.length}/${expectedContexts}**.\n`;
const content = `# Mobile failure report\n\n${summary}\n\n${sections.join("\n\n") || "## Result\n\nNo findings were collected. A zero-failure result requires a Complete audit."}\n`;
fs.writeFileSync(path.join(root, "docs/MOBILE_FAILURES.md"), content);
console.log(`Mobile failure report written: ${records.length} findings; ${completed.length}/${expectedContexts} collections; ${complete ? "complete" : "incomplete"}.`);
if (!complete) process.exitCode = 1;

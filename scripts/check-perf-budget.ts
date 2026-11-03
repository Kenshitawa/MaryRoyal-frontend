import fs from "node:fs";
import path from "node:path";

const MAX_PAGE_JS_KB = 250;
const MAX_SHARED_JS_KB = 350;
const root = path.resolve(__dirname, "..");
const distDir = process.env.NEXT_DIST_DIR ?? ".next";
const buildDir = path.join(root, distDir);
const buildManifestPath = path.join(buildDir, "build-manifest.json");
const appManifestPath = path.join(buildDir, "app-build-manifest.json");

if (!fs.existsSync(buildManifestPath) || !fs.existsSync(appManifestPath)) {
  console.error("Build manifests are missing. Run the matching build before checking its JavaScript budget.");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(buildManifestPath, "utf8")) as { rootMainFiles: string[] };
const appManifest = JSON.parse(fs.readFileSync(appManifestPath, "utf8")) as { pages: Record<string, string[]> };
const pages = Object.entries(appManifest.pages);
if (!pages.length) {
  console.error("No App Router entries were found in the build manifest.");
  process.exit(1);
}
const shared = new Set([
  ...manifest.rootMainFiles,
  ...(appManifest.pages["/layout"] ?? []),
  ...(appManifest.pages["/(portal)/layout"] ?? []),
].filter(file => file.endsWith(".js")));

function sizeKb(files: Iterable<string>) {
  let bytes = 0;
  for (const file of new Set(files)) {
    if (file.endsWith(".js")) bytes += fs.statSync(path.join(buildDir, file)).size;
  }
  return bytes / 1024;
}

let violations = 0;
const sharedKb = sizeKb(shared);
console.log(`JavaScript budget: ${distDir}; ${pages.length} App Router entries; shared ${sharedKb.toFixed(1)} KB.`);
if (sharedKb > MAX_SHARED_JS_KB) {
  console.error(`Shared JavaScript exceeds ${MAX_SHARED_JS_KB} KB.`);
  violations++;
}
let largestPageKb = 0;
for (const [route, files] of pages) {
  const pageKb = sizeKb(files.filter(file => !shared.has(file)));
  largestPageKb = Math.max(largestPageKb, pageKb);
  if (pageKb > MAX_PAGE_JS_KB) {
    console.error(`${route}: ${pageKb.toFixed(1)} KB exceeds the ${MAX_PAGE_JS_KB} KB page budget.`);
    violations++;
  }
}
console.log(`Largest route-specific JavaScript: ${largestPageKb.toFixed(1)} KB; ${violations} budget violations.`);
process.exitCode = violations ? 1 : 0;

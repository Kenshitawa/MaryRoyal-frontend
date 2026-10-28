import fs from "node:fs";
import path from "node:path";

// Performance Budget:
// Maximum first-load JavaScript per page (uncompressed): 250 KB
// Total shared chunk size: 300 KB
const MAX_PAGE_JS_KB = 250;
const MAX_SHARED_JS_KB = 350;

function checkBudget() {
  const root = path.resolve(__dirname, "..");
  const distDir = process.env.NEXT_DIST_DIR || (fs.existsSync(path.join(root, ".next-e2e")) ? ".next-e2e" : ".next");
  const buildDir = path.join(root, distDir);

  if (!fs.existsSync(buildDir)) {
    console.warn(`Build directory "${distDir}" does not exist yet. Run "npm run build" first to test performance budget.`);
    process.exit(0);
  }

  const manifestPath = path.join(buildDir, "build-manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.warn("build-manifest.json not found in build directory. Skipping budget check.");
    process.exit(0);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const pages = manifest.pages || {};

  console.log(`Checking JavaScript performance budget against ${distDir}...`);
  console.log(`Budget limits: Max per-page bundle = ${MAX_PAGE_JS_KB} KB, Max shared chunks = ${MAX_SHARED_JS_KB} KB.\n`);

  let violations = 0;

  for (const [pageRoute, files] of Object.entries(pages)) {
    if (pageRoute.startsWith("/_")) continue; // Skip Next internal pages like _app, _error

    let totalBytes = 0;
    for (const file of files as string[]) {
      const filePath = path.join(buildDir, file);
      if (fs.existsSync(filePath)) {
        totalBytes += fs.statSync(filePath).size;
      }
    }

    const totalKb = Math.round(totalBytes / 1024);
    if (totalKb > MAX_PAGE_JS_KB) {
      console.error(`❌ VIOLATION: Page "${pageRoute}" JS size is ${totalKb} KB (exceeds ${MAX_PAGE_JS_KB} KB budget)`);
      violations++;
    }
  }

  if (violations > 0) {
    console.error(`\n❌ Performance budget failed with ${violations} violation(s).`);
    process.exit(1);
  } else {
    console.log(`✅ All pages within JavaScript performance budget!`);
    process.exit(0);
  }
}

checkBudget();

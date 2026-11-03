import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { makeSession, makeActivitySession } from "../src/lib/session";

const db = new PrismaClient();
const BASE_URL = process.env.TEST_URL || "http://127.0.0.1:3187";

async function main() {
  await db.user.updateMany({
    where: { email: { in: ["director@maryroyal.ac.ke", "parent@maryroyal.ac.ke"] } },
    data: { forcePasswordChange: false, failedLogins: 0, suspended: false }
  });

  const director = await db.user.findUniqueOrThrow({ where: { email: "director@maryroyal.ac.ke" } });
  const parent = await db.user.findUniqueOrThrow({ where: { email: "parent@maryroyal.ac.ke" } });
  const sampleLearner = await db.learner.findFirst({ select: { id: true } });
  const learnerId = sampleLearner ? sampleLearner.id : "";

  const systemChrome = process.env.PLAYWRIGHT_CHROME_EXECUTABLE ?? (process.platform === "win32" && fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe") ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);

  console.log("Launching Chromium with Mobile Emulation (390x844), 4G Network & 4x CPU Throttling...");
  const browser = await chromium.launch({
    headless: true,
    ...(systemChrome ? { executablePath: systemChrome } : {}),
  });

  const directorSession = await makeSession(director);
  const directorActivity = await makeActivitySession(director.id);

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    isMobile: true,
    hasTouch: true,
  });

  await context.addCookies([
    { name: "mary_session", value: directorSession, domain: "127.0.0.1", path: "/" },
    { name: "mary_activity", value: directorActivity, domain: "127.0.0.1", path: "/" },
  ]);

  const page = await context.newPage();

  // Apply CDP network (Fast 4G) and CPU (4x slowdown) throttling
  const client = await context.newCDPSession(page);
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150, // 150ms RTT for mobile 4G
    downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
    uploadThroughput: (750 * 1024) / 8, // 750 kbps
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 }); // 4x mobile CPU slowdown

  const pagesToMeasure = [
    { name: "Dashboard (/dashboard)", url: `${BASE_URL}/dashboard` },
    { name: "Learners List (/learners)", url: `${BASE_URL}/learners` },
    { name: "Learner Profile (/learners/[id])", url: `${BASE_URL}/learners/${learnerId}` },
    { name: "Attendance (/attendance)", url: `${BASE_URL}/attendance` },
    { name: "Marks (/assessments)", url: `${BASE_URL}/assessments` },
    { name: "Invoices (/finance)", url: `${BASE_URL}/finance` },
    { name: "Payments (/finance?tab=payments)", url: `${BASE_URL}/finance?tab=payments` },
    { name: "Staff Directory (/staff)", url: `${BASE_URL}/staff` },
  ];

  const results = [];

  for (const item of pagesToMeasure) {
    let jsBytes = 0;
    const responseListener = async (response) => {
      try {
        const ct = response.headers()["content-type"] || "";
        if (ct.includes("javascript")) {
          const body = await response.body();
          jsBytes += body.length;
        }
      } catch {}
    };
    page.on("response", responseListener);

    // First visit
    const startFirst = performance.now();
    await page.goto(item.url, { waitUntil: "domcontentloaded" });
    const firstVisitTime = Math.round(performance.now() - startFirst);

    // Measure Web Vitals via in-page performance observer
    const vitals = await page.evaluate(async () => {
      return new Promise((resolve) => {
        let lcp = 0;
        let cls = 0;

        try {
          const lcpObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) lcp = Math.round(lastEntry.startTime);
          });
          lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });

          const clsObserver = new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries()) {
              if (!entry.hadRecentInput) {
                cls += entry.value;
              }
            }
          });
          clsObserver.observe({ type: "layout-shift", buffered: true });
        } catch {}

        setTimeout(() => {
          const navEntries = performance.getEntriesByType("navigation");
          const nav = navEntries.length > 0 ? navEntries[0] : null;
          const domReady = nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : 0;
          const duration = nav ? Math.round(nav.duration) : 0;
          resolve({ lcp, cls: Math.round(cls * 1000) / 1000, domReady, duration });
        }, 1200);
      });
    });

    page.off("response", responseListener);

    // Second visit / repeat navigation
    const startNav = performance.now();
    await page.goto(item.url, { waitUntil: "domcontentloaded" });
    const repeatNavTime = Math.round(performance.now() - startNav);

    results.push({
      page: item.name,
      firstVisitMs: firstVisitTime,
      repeatNavMs: repeatNavTime,
      lcpMs: vitals.lcp || firstVisitTime,
      cls: vitals.cls,
      jsWeightKb: Math.round(jsBytes / 1024),
    });
  }

  // Parent results (/portal)
  const parentSession = await makeSession(parent);
  const parentActivity = await makeActivitySession(parent.id);

  const parentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  await parentContext.addCookies([
    { name: "mary_session", value: parentSession, domain: "127.0.0.1", path: "/" },
    { name: "mary_activity", value: parentActivity, domain: "127.0.0.1", path: "/" },
  ]);

  const parentPage = await parentContext.newPage();
  const parentCdp = await parentContext.newCDPSession(parentPage);
  await parentCdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await parentCdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  let parentJsBytes = 0;
  parentPage.on("response", async (res) => {
    try {
      if ((res.headers()["content-type"] || "").includes("javascript")) {
        parentJsBytes += (await res.body()).length;
      }
    } catch {}
  });

  const pStart = performance.now();
  await parentPage.goto(`${BASE_URL}/portal`, { waitUntil: "domcontentloaded" });
  const pFirst = Math.round(performance.now() - pStart);
  const pNavStart = performance.now();
  await parentPage.goto(`${BASE_URL}/portal`, { waitUntil: "domcontentloaded" });
  const pRepeat = Math.round(performance.now() - pNavStart);

  results.push({
    page: "Parent Results (/portal)",
    firstVisitMs: pFirst,
    repeatNavMs: pRepeat,
    lcpMs: pFirst,
    cls: 0,
    jsWeightKb: Math.round(parentJsBytes / 1024),
  });

  console.log("\n=================== BENCHMARK RESULTS ===================");
  console.table(results);
  console.log("=========================================================\n");

  fs.writeFileSync("perf-results.json", JSON.stringify(results, null, 2));

  await browser.close();
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("Benchmark failed:", e);
  await db.$disconnect();
  process.exit(1);
});

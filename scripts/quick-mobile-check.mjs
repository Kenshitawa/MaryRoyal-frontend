import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.env.CHECK_BASE ?? "http://127.0.0.1:3190";
const sample = JSON.parse(fs.readFileSync(path.resolve("e2e/.auth/sample-records.json"), "utf8"));
const chrome = fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe") ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined;
const targets = [
  ["director", `/learners/${sample.learnerId}`],
  ["director", `/staff/${sample.staffId}`],
  ["parent", `/receipts/${sample.paymentId}`],
  ["secretary", `/learners/${sample.learnerId}/edit`],
];
const browser = await chromium.launch({ executablePath: chrome });
for (const [role, route] of targets) {
  const context = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, storageState: path.resolve(`e2e/.auth/${role}.json`) });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base + route, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(300);
  const scrollers = await page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.overflowX === "auto" || style.overflowX === "scroll";
      })
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => `${element.tagName}.${element.className.toString().slice(0, 70)} ${element.scrollWidth}>${element.clientWidth}`),
  );
  const smallText = await page.evaluate(() =>
    [...document.querySelectorAll("main *")].filter((element) => {
      if (!element.children.length && !element.textContent?.trim()) return false;
      const size = parseFloat(getComputedStyle(element).fontSize);
      const cls = element.className?.toString() ?? "";
      return size < 13 && !/(badge|pill|caption|text-xs|text-\[1[012]px\]|sr-only)/.test(cls);
    }).length,
  );
  console.log(`${role} ${route}: scrollers=${scrollers.length} ${scrollers.slice(0, 3).join(" | ")} smallText=${smallText} errors=${errors.length}`);
  const file = `mobile-shots/check-${role}-${route.replaceAll("/", "_")}.png`;
  await page.screenshot({ path: path.resolve(file), fullPage: false });
  await context.close();
}
await browser.close();

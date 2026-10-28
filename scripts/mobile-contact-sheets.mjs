import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const dir = path.resolve("mobile-shots");
const chrome = process.env.PLAYWRIGHT_CHROME_EXECUTABLE ?? (process.platform === "win32" && fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe") ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
const pngs = fs.readdirSync(dir).filter((file) => file.endsWith(".png") && !file.startsWith("contact-"));
const knownRoles = ["non_teaching_staff", "welfare_chair", "head_teacher", "director", "secretary", "accountant", "teacher", "parent", "learner", "deputy"];
const roleOf = (file) => knownRoles.find((role) => file.startsWith(`${role}_`));
const roles = [...new Set(pngs.map(roleOf))].filter(Boolean).sort();

const browser = await chromium.launch({ executablePath: chrome });
for (const role of roles) {
  const files = pngs.filter((file) => file.startsWith(`${role}_`)).sort();
  const cards = files
    .map((file) => {
      const label = file.replace(`${role}_`, "/").replace(/\.png$/, "").replaceAll("_", "/");
      const src = `file:///${dir.replaceAll("\\", "/")}/${encodeURIComponent(file)}`;
      return `<figure><img src="${src}" alt="${role} ${label}"><figcaption>${label}</figcaption></figure>`;
    })
    .join("");
  const html = `<!doctype html><meta charset="utf-8"><title>${role} mobile contact sheet</title>
<style>
  :root { color-scheme: light }
  body { margin: 0; padding: 24px; background: #eef2f9; font: 600 13px/1.4 Inter, system-ui, sans-serif; color: #0f172a }
  h1 { margin: 0 0 16px; font-size: 20px; color: #1e3a8a; text-transform: capitalize }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px }
  figure { margin: 0; background: #fff; border: 1px solid #d8e2f1; border-radius: 12px; overflow: hidden }
  img { display: block; width: 100%; height: 760px; object-fit: cover; object-position: top; border-bottom: 1px solid #e2e8f0 }
  figcaption { padding: 8px 10px; font-size: 12px; color: #1e40af }
</style>
<h1>${role.replaceAll("_", " ")} — 360px screenshots</h1>
<div class="grid">${cards}</div>`;
  const sheetPath = path.join(dir, `_sheet-${role}.html`);
  fs.writeFileSync(sheetPath, html);
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(`file:///${sheetPath.replaceAll("\\", "/")}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dir, `contact-${role}.png`), fullPage: true });
  await page.close();
  console.log(`${role}: ${files.length} shots`);
}
await browser.close();

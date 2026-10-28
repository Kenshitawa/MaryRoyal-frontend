import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SHOT_BASE ?? "http://127.0.0.1:3000";
const outDir = path.resolve("mobile-shots");
const width = Number(process.env.SHOT_WIDTH ?? 360);
const roles = (process.env.SHOT_ROLES ?? "").split(",").filter(Boolean);

const rolePages = {
  director: ["/dashboard", "/accounts", "/admissions", "/learners", "/staff", "/staff/new", "/assessments", "/assessments/exams", "/assessments/rubrics", "/attendance", "/finance", "/finance/structures", "/reports", "/audit", "/timetable", "/learning-videos", "/complaints", "/schemes", "/teaching-log", "/library", "/welfare", "/profile"],
  head_teacher: ["/dashboard", "/admissions", "/learners", "/staff", "/staff/new", "/assessments", "/attendance", "/finance", "/reports", "/complaints", "/profile"],
  deputy: ["/dashboard", "/admissions", "/learners", "/assessments", "/attendance", "/timetable", "/schemes", "/library", "/welfare"],
  secretary: ["/dashboard", "/admissions", "/admissions/new", "/learners", "/finance", "/finance/structures", "/profile"],
  accountant: ["/dashboard", "/learners", "/finance", "/finance/structures", "/profile"],
  teacher: ["/dashboard", "/attendance", "/learners", "/assessments", "/assignments", "/learning-content", "/learning-videos", "/teaching-log", "/schemes", "/library", "/timetable"],
  parent: ["/portal", "/complaints", "/profile"],
  learner: ["/learning", "/assignments", "/learning-videos", "/profile"],
  welfare_chair: ["/dashboard", "/welfare", "/profile"],
  non_teaching_staff: ["/dashboard", "/welfare", "/profile"],
};

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: fs.existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe") ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined,
});
const selected = roles.length ? Object.keys(rolePages).filter((role) => roles.includes(role)) : Object.keys(rolePages);
for (const role of selected) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    storageState: path.resolve(`e2e/.auth/${role}.json`),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("Failed to load resource")) errors.push(message.text());
  });
  const shots = [];
  for (const route of rolePages[role]) {
    const file = `${role}${route.replaceAll("/", "_")}.png`;
    try {
      await page.goto(base + route, { waitUntil: "networkidle", timeout: 60_000 });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(outDir, file), fullPage: process.env.SHOT_FULL !== "0" });
      shots.push(file);
    } catch (error) {
      console.log(`FAIL ${role} ${route}: ${error.message.split("\n")[0]}`);
    }
  }
  console.log(`${role}: ${shots.length} shots${errors.length ? ` | errors: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  await context.close();
}
await browser.close();

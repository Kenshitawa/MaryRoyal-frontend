import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import axe from "axe-core";

const viewports = [
  { width: 360, height: 740, name: "compact Android" },
  { width: 390, height: 844, name: "standard phone" },
] as const;
const appearances = [
  { mode: "light", style: "bento" },
  { mode: "dark", style: "bento" },
  { mode: "light", style: "glass" },
  { mode: "dark", style: "glass" },
] as const;
const rolePages: Record<string, string[]> = {
  director: ["/dashboard", "/accounts", "/admissions", "/admissions/new", "/learners", "/staff", "/staff/new", "/assessments", "/assessments/exams", "/assessments/rubrics", "/attendance", "/finance", "/finance/structures", "/reports", "/audit", "/timetable", "/learning-videos", "/complaints", "/schemes", "/teaching-log", "/library", "/welfare", "/profile", "/privacy", "/change-password"],
  head_teacher: ["/dashboard", "/admissions", "/learners", "/staff", "/staff/new", "/assessments", "/assessments/exams", "/assessments/rubrics", "/attendance", "/finance", "/finance/structures", "/reports", "/audit", "/timetable", "/learning-videos", "/complaints", "/schemes", "/teaching-log", "/library", "/welfare", "/profile", "/privacy", "/change-password"],
  deputy: ["/dashboard", "/admissions", "/learners", "/assessments", "/assessments/exams", "/assessments/rubrics", "/attendance", "/timetable", "/learning-videos", "/schemes", "/library", "/welfare", "/profile", "/privacy", "/change-password"],
  secretary: ["/dashboard", "/admissions", "/admissions/new", "/learners", "/finance", "/finance/structures", "/welfare", "/profile", "/privacy", "/change-password"],
  accountant: ["/dashboard", "/learners", "/finance", "/finance/structures", "/profile", "/privacy", "/change-password"],
  teacher: ["/dashboard", "/attendance", "/learners", "/assessments", "/assessments/exams", "/assessments/rubrics", "/assignments", "/learning-content", "/learning-videos", "/teaching-log", "/schemes", "/library", "/welfare", "/timetable", "/profile", "/privacy", "/change-password"],
  parent: ["/portal", "/complaints", "/profile", "/privacy", "/change-password"],
  learner: ["/learning", "/assignments", "/learning-videos", "/profile", "/privacy", "/change-password"],
  welfare_chair: ["/dashboard", "/welfare", "/profile", "/privacy", "/change-password"],
  non_teaching_staff: ["/dashboard", "/welfare", "/profile", "/privacy", "/change-password"],
};
const allRoutes = [...new Set(Object.values(rolePages).flat())].sort();
const collectionPath = path.resolve(process.cwd(), "test-results/mobile-failure-collection.jsonl");

type Finding = { cause: string; role: string; route: string; width: number; mode: string; style: string; detail: string };
type AuditResult = { findings: Omit<Finding, "role" | "route" | "width" | "mode" | "style">[]; pageWidth: number; viewportWidth: number };

type AxeViolationResult = {
  violations: Array<{ id: string; nodes: Array<{ target: string[]; failureSummary?: string }> }>;
};

declare global {
  interface Window {
    axe?: { run: (context: Document, options: { runOnly: { type: "rule"; values: string[] } }) => Promise<AxeViolationResult> };
  }
}
function persistFindings(items: Finding[]) {
  for (const item of items) fs.appendFileSync(collectionPath, `${JSON.stringify({ kind: "finding", ...item })}\n`);
}

async function inspectPage(page: Page): Promise<AuditResult> {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const node = element as HTMLElement;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      if (node.classList.contains("sr-only") && !node.matches(":focus")) return false;
      if (style.clipPath === "inset(50%)" || style.clip === "rect(0px, 0px, 0px, 0px)") return false;
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
    };
    const selector = (element: Element) => {
      const node = element as HTMLElement;
      const id = node.id ? `#${CSS.escape(node.id)}` : "";
      const classes = Array.from(node.classList).slice(0, 3).map((name) => `.${CSS.escape(name)}`).join("");
      return `${node.tagName.toLowerCase()}${id}${classes}`;
    };
    const name = (element: Element) => {
      const node = element as HTMLElement;
      const labelledBy = node.getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
      const labels = "labels" in node ? Array.from((node as HTMLInputElement).labels ?? []).map((label) => label.textContent?.trim() ?? "").filter(Boolean).join(" ") : "";
      const placeholder = "placeholder" in node ? String((node as HTMLInputElement).placeholder ?? "") : "";
      return node.getAttribute("aria-label") || labelledBy || labels || node.getAttribute("title") || node.innerText?.trim().replace(/\s+/g, " ").slice(0, 90) || placeholder || "(unnamed)";
    };
    const actionable = Array.from(document.querySelectorAll("button, a[href], input:not([type='hidden']), select, textarea, [role='button'], [role='link'], [role='checkbox'], [role='radio']")).filter(visible);
    const notes: AuditResult["findings"] = [];
    const proseLink = (element: Element) => {
      if (element.tagName !== "A") return false;
      const paragraph = element.closest("p");
      if (!paragraph || !paragraph.contains(element)) return false;
      const prose = paragraph.textContent?.trim() ?? "";
      const linkText = element.textContent?.trim() ?? "";
      return prose.length > linkText.length + 8 && /\s/.test(prose.replace(linkText, ""));
    };
    for (const element of actionable) {
      if (proseLink(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width < 44 || rect.height < 44) {
        notes.push({ cause: "Touch targets under 44px", detail: `${selector(element)} “${name(element)}” ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}px` });
      }
      if (name(element) === "(unnamed)") {
        notes.push({ cause: "Controls without accessible names", detail: `${selector(element)} has no accessible name` });
      }
    }
    const viewportWidth = document.documentElement.clientWidth;
    const overflowNodes = Array.from(document.body.querySelectorAll("*"))
      .filter(visible)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > viewportWidth + 1 || rect.right > viewportWidth + 1 || rect.left < -1)
      .sort((a, b) => b.rect.width - a.rect.width)
      .slice(0, 10);
    const pageWidth = document.documentElement.scrollWidth;
    if (pageWidth > viewportWidth + 1 || overflowNodes.length > 0) {
      for (const { element, rect } of overflowNodes) {
        const chain: string[] = [];
        let current: Element | null = element;
        for (let depth = 0; current && depth < 5; depth++, current = current.parentElement) chain.push(selector(current));
        notes.push({ cause: "Horizontal overflow", detail: `${selector(element)} ${rect.width.toFixed(1)}px wide; chain ${chain.join(" ← ")}` });
      }
    }
    const mains = Array.from(document.querySelectorAll("main"));
    const headings = Array.from(document.querySelectorAll("h1")).filter(visible);
    if (mains.length !== 1) notes.push({ cause: "Page landmarks and headings", detail: `found ${mains.length} <main> landmarks${mains.length > 1 ? `; nested=${mains.some((main) => main.parentElement?.closest("main"))}` : ""}` });
    if (headings.length !== 1) notes.push({ cause: "Page landmarks and headings", detail: `found ${headings.length} visible <h1> headings` });
    for (const landmark of ["header", "nav"]) {
      const visibleLandmarks = Array.from(document.querySelectorAll(landmark)).filter(visible);
      const unlabeled = visibleLandmarks.filter((element) => !element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby"));
      if (visibleLandmarks.length === 0 || unlabeled.length > 0) notes.push({ cause: "Page landmarks and headings", detail: `${landmark}: ${visibleLandmarks.length} visible, ${unlabeled.length} without accessible label` });
    }
    const skip = Array.from(document.querySelectorAll("a[href^='#']")).find((element) => /skip to (main )?content/i.test(name(element)));
    if (!skip) notes.push({ cause: "Page landmarks and headings", detail: "missing Skip to content link" });
    for (const element of Array.from(document.querySelectorAll("body *")).filter(visible)) {
      if (element instanceof SVGElement) continue;
      if (!element.children.length && !element.textContent?.trim()) continue;
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
      const badgeOrTime = element.matches("time,[data-badge='true'],.badge,.status-badge") || /badge|pill/.test(element.className?.toString() ?? "");
      const minimum = badgeOrTime ? 12 : 14;
      if (fontSize < minimum) notes.push({ cause: "Text below allowed sizes", detail: `${selector(element)} “${element.textContent?.trim().replace(/\s+/g, " ").slice(0, 50)}” ${fontSize.toFixed(1)}px (minimum ${minimum}px)` });
    }
    return { findings: notes, pageWidth, viewportWidth };
  });
  const contrast = await page.evaluate(async () => {
    if (!window.axe) return [{ target: "document", summary: "axe-core did not load" }];
    const result = await window.axe.run(document, { runOnly: { type: "rule", values: ["color-contrast"] } });
    return result.violations.flatMap((violation) => violation.nodes.map((node) => ({ target: node.target.join(", "), summary: node.failureSummary ?? violation.id })));
  });
  return { ...layout, findings: [...layout.findings, ...contrast.map((item) => ({ cause: "WCAG text contrast", detail: `${item.target}: ${item.summary.replace(/\s+/g, " ").slice(0, 180)}` }))] };
}

test.describe("Complete mobile audit, every role and route", () => {
  for (const viewport of viewports) {
    test.describe(`${viewport.name} (${viewport.width}px)`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });
      for (const role of Object.keys(rolePages)) {
        test.describe(`Role ${role}`, () => {
          test.use({ storageState: path.resolve(__dirname, `.auth/${role}.json`) });
          test(`collects all violations across ${allRoutes.length} routes and four appearances`, async ({ page }) => {
            test.setTimeout(180_000);
            const roleFindings: Finding[] = [];
            const consoleErrors: string[] = [];
            const failedRequests: string[] = [];
            page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
            page.on("requestfailed", (request) => { failedRequests.push(`${request.method()} ${new URL(request.url()).pathname}`); });
            for (const route of allRoutes) {
              const routeStart = roleFindings.length;
              const isAuthorizedPage = rolePages[role].includes(route);
              consoleErrors.length = 0;
              failedRequests.length = 0;
              let responseStatus: number | null = null;
              try {
                const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15000 });
                responseStatus = response?.status() ?? null;
                await page.waitForTimeout(100);
              } catch (error) {
                await page.waitForTimeout(150);
                const settledPath = new URL(page.url()).pathname;
                if (isAuthorizedPage && settledPath !== route) {
                  roleFindings.push({ cause: "Authorized route unavailable", role, route, width: viewport.width, mode: "light", style: "bento", detail: `navigation redirected to ${settledPath}` });
                } else if (isAuthorizedPage) {
                  roleFindings.push({ cause: "Page load or runtime errors", role, route, width: viewport.width, mode: "light", style: "bento", detail: error instanceof Error ? error.message.slice(0, 180) : "page navigation failed" });
                }
                const current = roleFindings.slice(routeStart);
                persistFindings(current);
                continue;
              }
              const finalPath = new URL(page.url()).pathname;
              if (!isAuthorizedPage) {
                if (finalPath === route && (!responseStatus || responseStatus < 400)) {
                  roleFindings.push({ cause: "Route authorization", role, route, width: viewport.width, mode: "light", style: "bento", detail: "restricted route remained accessible to this role" });
                }
                const current = roleFindings.slice(routeStart);
                persistFindings(current);
                continue;
              }
              if (finalPath !== route) {
                roleFindings.push({ cause: "Authorized route unavailable", role, route, width: viewport.width, mode: "light", style: "bento", detail: `expected route but was sent to ${finalPath}` });
                const current = roleFindings.slice(routeStart);
                persistFindings(current);
                continue;
              }
              await page.waitForSelector("main", { timeout: 1000 }).catch(() => undefined);
              for (const appearance of appearances) {
                try {
                  await page.evaluate(({ mode, style }) => {
                    localStorage.setItem("mary-theme", mode);
                    localStorage.setItem("mary-style", style);
                    document.documentElement.dataset.theme = mode;
                    document.documentElement.dataset.style = style;
                  }, appearance);
                  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
                  const result = await inspectPage(page);
                  for (const item of result.findings) roleFindings.push({ ...item, role, route, width: viewport.width, mode: appearance.mode, style: appearance.style });
                } catch (error) {
                  roleFindings.push({ cause: "Page load or runtime errors", role, route, width: viewport.width, mode: appearance.mode, style: appearance.style, detail: error instanceof Error ? error.message.slice(0, 180) : "audit evaluation failed" });
                  await page.waitForLoadState("domcontentloaded", { timeout: 3000 }).catch(() => undefined);
                }
                if (responseStatus && responseStatus >= 400) roleFindings.push({ cause: "Page load or runtime errors", role, route, width: viewport.width, mode: appearance.mode, style: appearance.style, detail: `HTTP ${responseStatus}` });
                for (const error of consoleErrors) roleFindings.push({ cause: "Console errors", role, route, width: viewport.width, mode: appearance.mode, style: appearance.style, detail: error.slice(0, 180) });
                for (const request of failedRequests) roleFindings.push({ cause: "Failed requests", role, route, width: viewport.width, mode: appearance.mode, style: appearance.style, detail: request });
              }
              const current = roleFindings.slice(routeStart);
              persistFindings(current);
            }
            fs.appendFileSync(collectionPath, `${JSON.stringify({ kind: "complete", role, width: viewport.width, findingCount: roleFindings.length })}\n`);
            expect(roleFindings.length, `${role} mobile violations (details in docs/MOBILE_FAILURES.md)`).toBe(0);
          });
        });
      }
    });
  }
});

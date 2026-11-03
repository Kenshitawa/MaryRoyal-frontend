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
  head_teacher: ["/dashboard", "/admissions", "/learners", "/staff", "/staff/new", "/assessments", "/assessments/exams", "/assessments/rubrics", "/attendance", "/finance", "/finance/structures", "/audit", "/timetable", "/learning-videos", "/complaints", "/schemes", "/teaching-log", "/library", "/welfare", "/profile", "/privacy", "/change-password"],
  deputy: ["/dashboard", "/admissions", "/learners", "/assessments", "/assessments/exams", "/assessments/rubrics", "/attendance", "/timetable", "/learning-videos", "/schemes", "/library", "/welfare", "/profile", "/privacy", "/change-password"],
  secretary: ["/dashboard", "/admissions", "/admissions/new", "/learners", "/finance", "/finance/structures", "/welfare", "/profile", "/privacy", "/change-password"],
  accountant: ["/dashboard", "/learners", "/finance", "/finance/structures", "/welfare", "/profile", "/privacy", "/change-password"],
  teacher: ["/dashboard", "/attendance", "/learners", "/assessments", "/assessments/exams", "/assessments/rubrics", "/assignments", "/learning-content", "/learning-videos", "/teaching-log", "/schemes", "/library", "/welfare", "/timetable", "/profile", "/privacy", "/change-password"],
  parent: ["/portal", "/complaints", "/profile", "/privacy", "/change-password"],
  learner: ["/learning", "/assignments", "/learning-videos", "/portal", "/profile", "/privacy", "/change-password"],
  welfare_chair: ["/dashboard", "/welfare", "/profile", "/privacy", "/change-password"],
  non_teaching_staff: ["/dashboard", "/welfare", "/profile", "/privacy", "/change-password"],
};
const samplePath = path.resolve(__dirname, ".auth/sample-records.json");
const sample: Record<string, string | null> = fs.existsSync(samplePath) ? JSON.parse(fs.readFileSync(samplePath, "utf8")) : {};
const detailRoutes = (role: string, routes: Array<[string | null, string]>) => {
  for (const [id, template] of routes) {
    if (!id) continue;
    const route = template.replace("{id}", id);
    if (!rolePages[role].includes(route)) rolePages[role].push(route);
  }
};
detailRoutes("director", [
  [sample.learnerId, "/learners/{id}"],
  [sample.staffId, "/staff/{id}"],
  [sample.reviewDraftId, "/admissions/{id}"],
  [sample.paymentId, "/receipts/{id}"],
]);
detailRoutes("head_teacher", [
  [sample.learnerId, "/learners/{id}"],
  [sample.learnerId, "/learners/{id}/edit"],
  [sample.staffId, "/staff/{id}"],
  [sample.reviewDraftId, "/admissions/{id}"],
  [sample.paymentId, "/receipts/{id}"],
]);
detailRoutes("deputy", [[sample.learnerId, "/learners/{id}"]]);
detailRoutes("secretary", [
  [sample.learnerId, "/learners/{id}"],
  [sample.learnerId, "/learners/{id}/edit"],
  [sample.secretaryDraftId, "/admissions/{id}"],
]);
detailRoutes("accountant", [
  [sample.learnerId, "/learners/{id}"],
  [sample.paymentId, "/receipts/{id}"],
]);
detailRoutes("teacher", [[sample.teacherLearnerId, "/learners/{id}"], [sample.staffId, "/staff/{id}"]]);
detailRoutes("parent", [
  [sample.learnerId, "/learners/{id}"],
  [sample.paymentId, "/receipts/{id}"],
]);
detailRoutes("learner", [[sample.selfLearnerId, "/learners/{id}"]]);
for (const role of ["director", "deputy", "secretary"]) {
  detailRoutes(role, [[sample.secretaryDraftId, "/admissions/{id}"], [sample.reviewDraftId, "/admissions/{id}"]]);
}
for (const role of Object.keys(rolePages)) {
  if (sample[`${role}StaffId`]) detailRoutes(role, [[sample[`${role}StaffId`], "/staff/{id}"]]);
}
for (const id of [sample.directorStaffId, sample.head_teacherStaffId, sample.deputyStaffId, sample.secretaryStaffId, sample.accountantStaffId, sample.welfare_chairStaffId, sample.non_teaching_staffStaffId]) {
  detailRoutes("director", [[id, "/staff/{id}"]]);
  detailRoutes("head_teacher", [[id, "/staff/{id}"]]);
}
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
  await page.addScriptTag({ content: axe.source });
  const layout = await page.evaluate(() => {
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
    const horizontalScrollers = Array.from(document.body.querySelectorAll("*"))
      .filter(visible)
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .filter((element) => getComputedStyle(element).overflowX === "auto" || getComputedStyle(element).overflowX === "scroll");
    const overflowNodes = Array.from(document.body.querySelectorAll("*"))
      .filter(visible)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ element, rect }) => {
        if (rect.width <= viewportWidth + 1 && rect.right <= viewportWidth + 1 && rect.left >= -1) return false;
        const clippingAncestor = element.parentElement?.closest("[class*='overflow-hidden'],[style*='overflow: hidden'],[style*='overflow-x: hidden']");
        return !clippingAncestor && !horizontalScrollers.some((scroller) => scroller.contains(element));
      })
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
      if (element instanceof SVGElement || element.closest("svg")) continue;
      if (!element.children.length && !element.textContent?.trim()) continue;
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
      const tierOf = (node: Element | null | undefined) => {
        if (!node) return null;
        const classes = node.className?.toString() ?? "";
        if (node.matches("time,caption,figcaption,[data-badge='true'],.badge,.status-badge,.meta") || /(badge|pill|caption|(^|\s)text-xs(\s|$)|text-\[(?:8\.5|9|10|11|12)px\])/.test(classes)) return 12;
        if (node.matches("label,.field-label,.text-label,.chip,.mobile-nav-item,button,a[href],[data-text='secondary']") || /(text-label|field-label|field-help|mobile-nav-item|secondary|text-sm|text-\[13(?:\.5)?px\])/.test(classes)) return 13;
        return null;
      };
      // Nested spans inherit the tier of their label/caption container or control.
      const tierChain = [element, element.parentElement, element.parentElement?.parentElement];
      const inherited = tierChain.map(tierOf).find((tier) => tier !== null) ?? null;
      const minimum = inherited ?? 14;
      if (fontSize < minimum) notes.push({ cause: "Text below allowed sizes", detail: `${selector(element)} “${element.textContent?.trim().replace(/\s+/g, " ").slice(0, 50)}” ${fontSize.toFixed(1)}px (minimum ${minimum}px)` });
    }
    for (const scroller of horizontalScrollers) {
      const chain: string[] = [];
      for (let current: Element | null = scroller; current && chain.length < 5; current = current.parentElement) chain.push(selector(current));
      notes.push({ cause: "Horizontal overflow", detail: `${selector(scroller)} horizontal scroll ${scroller.scrollWidth}px inside ${scroller.clientWidth}px; chain ${chain.join(" ← ")}` });
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
            page.on("console", (message) => {
              if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) consoleErrors.push(message.text());
            });
            page.on("response", (response) => {
              if (response.status() >= 400) failedRequests.push(`${response.request().method()} ${new URL(response.url()).pathname} HTTP ${response.status()}`);
            });
            page.on("requestfailed", (request) => {
              const reason = request.failure()?.errorText ?? "unknown network failure";
              if (!/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(reason)) failedRequests.push(`${request.method()} ${new URL(request.url()).pathname} ${reason}`);
            });
            for (const route of allRoutes) {
              const routeStart = roleFindings.length;
              const isAuthorizedPage = rolePages[role].includes(route);
              consoleErrors.length = 0;
              failedRequests.length = 0;
              let responseStatus: number | null = null;
              let navigationError: unknown = null;
              for (let attempt = 0; attempt < 2; attempt++) {
                try {
                  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15000 });
                  responseStatus = response?.status() ?? null;
                  navigationError = null;
                  break;
                } catch (error) {
                  navigationError = error;
                  await page.waitForTimeout(300);
                }
              }
              if (navigationError) {
                const settledPath = new URL(page.url()).pathname;
                if (isAuthorizedPage && settledPath !== route) {
                  roleFindings.push({ cause: "Authorized route unavailable", role, route, width: viewport.width, mode: "light", style: "bento", detail: `navigation redirected to ${settledPath}` });
                } else if (isAuthorizedPage) {
                  roleFindings.push({ cause: "Page load or runtime errors", role, route, width: viewport.width, mode: "light", style: "bento", detail: navigationError instanceof Error ? navigationError.message.slice(0, 180) : "page navigation failed" });
                }
                const current = roleFindings.slice(routeStart);
                persistFindings(current);
                continue;
              }
              await page.locator("main h1").first().waitFor({ state: "visible", timeout: 5000 }).catch(() => undefined);
              const finalPath = new URL(page.url()).pathname;
              const recordUnavailable = await page.getByRole("heading", { name: "We could not find that page", exact: true }).isVisible();
              if (!isAuthorizedPage) {
                // Next.js streams notFound() with HTTP 200 after the shell has started.
                if (finalPath === route && (!responseStatus || responseStatus < 400) && !recordUnavailable) {
                  roleFindings.push({ cause: "Route authorization", role, route, width: viewport.width, mode: "light", style: "bento", detail: "restricted route remained accessible to this role" });
                }
                const current = roleFindings.slice(routeStart);
                persistFindings(current);
                continue;
              }
              if (finalPath !== route || recordUnavailable) {
                roleFindings.push({ cause: "Authorized route unavailable", role, route, width: viewport.width, mode: "light", style: "bento", detail: recordUnavailable ? "authorized record rendered the unavailable page" : `expected route but was sent to ${finalPath}` });
                const current = roleFindings.slice(routeStart);
                persistFindings(current);
                continue;
              }
              await page.evaluate(async () => {
                const animations = document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity);
                await Promise.all(animations.map(animation => animation.finished.catch(() => undefined)));
              });
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
            fs.appendFileSync(collectionPath, `${JSON.stringify({ kind: "complete", role, width: viewport.width, routeCount: allRoutes.length, renderedRouteCount: rolePages[role].length, findingCount: roleFindings.length })}\n`);
            expect(roleFindings.length, `${role} mobile violations (details in docs/MOBILE_FAILURES.md)`).toBe(0);
          });
        });
      }
    });
  }
});

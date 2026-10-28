import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

const viewports = [
  { width: 360, height: 740, name: "compact Android" },
  { width: 390, height: 844, name: "standard phone" },
];

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

type AuditResult = {
  overflow: number;
  mainCount: number;
  undersized: string[];
  unnamed: string[];
};

async function auditCurrentPage(page: Page): Promise<AuditResult> {
  return page.evaluate(() => {
    const isVisible = (element: Element) => {
      const node = element as HTMLElement;
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && style.opacity !== "0";
    };
    const accessibleName = (element: Element) => {
      const node = element as HTMLElement;
      const labelledBy = node.getAttribute("aria-labelledby")
        ?.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .join(" ");
      const associatedLabel = node instanceof HTMLInputElement || node instanceof HTMLSelectElement || node instanceof HTMLTextAreaElement
        ? node.labels?.[0]?.textContent?.trim()
        : undefined;
      return node.getAttribute("aria-label") || labelledBy || associatedLabel || node.getAttribute("title") || node.textContent?.trim() || node.getAttribute("placeholder") || "";
    };
    const targets = Array.from(document.querySelectorAll(
      "button, a[href], input:not([type='hidden']), select, textarea, [role='button'], [role='link'], [role='checkbox'], [role='radio']",
    )).filter(isVisible);
    const undersized = targets
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width < 44 || rect.height < 44;
      })
      .slice(0, 12)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label = accessibleName(element).replace(/\s+/g, " ").slice(0, 32) || element.tagName.toLowerCase();
        return `${label} (${Math.round(rect.width)}×${Math.round(rect.height)})`;
      });
    const unnamed = targets
      .filter((element) => !accessibleName(element))
      .slice(0, 12)
      .map((element) => element.outerHTML.slice(0, 90));
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      mainCount: document.querySelectorAll("main").length,
      undersized,
      unnamed,
    };
  });
}

async function checkAppearance(page: Page, route: string, mode: "light" | "dark", style: "bento" | "glass") {
  await page.evaluate(({ nextMode, nextStyle }) => {
    localStorage.setItem("mary-theme", nextMode);
    localStorage.setItem("mary-style", nextStyle);
  }, { nextMode: mode, nextStyle: style });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("main", { timeout: 10000 });
  await page.waitForFunction(({ nextMode, nextStyle }) => {
    const expectedTheme = nextMode === "dark" ? "dark" : "light";
    return document.documentElement.dataset.theme === expectedTheme && document.documentElement.dataset.style === nextStyle;
  }, { nextMode: mode, nextStyle: style });

  const result = await auditCurrentPage(page);
  expect(result.overflow, `${route} ${mode}/${style}: horizontal overflow`).toBeLessThanOrEqual(0);
  expect(result.mainCount, `${route} ${mode}/${style}: expected one main landmark`).toBe(1);
  expect(result.undersized, `${route} ${mode}/${style}: every visible control must be at least 44×44`).toEqual([]);
  expect(result.unnamed, `${route} ${mode}/${style}: controls need accessible names`).toEqual([]);
}

test.describe("Mobile page audit at 360px and 390px", () => {
  for (const viewport of viewports) {
    test.describe(`${viewport.name} (${viewport.width}px)`, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      test("public sign-in shell is responsive", async ({ page }) => {
        const consoleErrors: string[] = [];
        const failedRequests: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("requestfailed", (request) => failedRequests.push(request.url()));
        await page.goto("/", { waitUntil: "domcontentloaded" });
        for (const appearance of appearances) {
          await checkAppearance(page, "/", appearance.mode, appearance.style);
        }
        expect(consoleErrors.filter((error) => !error.includes("Download the React DevTools"))).toEqual([]);
        expect(failedRequests).toEqual([]);
      });

      for (const [role, routes] of Object.entries(rolePages)) {
        test.describe(`Role: ${role}`, () => {
          test.use({ storageState: path.resolve(__dirname, `.auth/${role}.json`) });

          for (const route of routes) {
            test(`${route} passes mobile checks in all appearance modes`, async ({ page }) => {
              const consoleErrors: string[] = [];
              const failedRequests: string[] = [];
              page.on("console", (message) => {
                if (message.type() === "error") consoleErrors.push(message.text());
              });
              page.on("requestfailed", (request) => failedRequests.push(request.url()));
              const response = await page.goto(route, { waitUntil: "domcontentloaded" });
              expect(response?.status(), `${role} ${route} response`).toBeLessThan(400);
              expect(new URL(page.url()).pathname, `${role} ${route} must remain on the requested page`).toBe(route);
              await page.waitForSelector("main", { timeout: 10000 });

              for (const appearance of appearances) {
                await checkAppearance(page, route, appearance.mode, appearance.style);
              }

              expect(consoleErrors.filter((error) => !error.includes("Download the React DevTools")), `${role} ${route} console errors`).toEqual([]);
              expect(failedRequests, `${role} ${route} failed requests`).toEqual([]);
            });
          }
        });
      }
    });
  }
});

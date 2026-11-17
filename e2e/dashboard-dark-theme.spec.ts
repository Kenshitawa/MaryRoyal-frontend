import { expect, test } from "@playwright/test";

test.use({ storageState: "e2e/.auth/director.json" });

test("dashboard metric cards use distinct, readable dark-mode colours", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");

  const modeToggle = page.getByRole("button", { name: /Switch mode \(currently Light\)/ });
  await expect(modeToggle).toBeVisible();
  await modeToggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  const cards = page.locator(".dashboard-stat");
  await expect(cards).toHaveCount(8);
  const styles = await cards.evaluateAll((elements) =>
    elements.map((element) => ({
      tone: element.getAttribute("data-dashboard-tone"),
      background: getComputedStyle(element).backgroundImage,
      border: getComputedStyle(element).borderColor,
    })),
  );

  expect(new Set(styles.map((item) => item.tone)).size).toBeGreaterThanOrEqual(4);
  expect(new Set(styles.map((item) => item.background)).size).toBeGreaterThanOrEqual(4);
  expect(styles.every((item) => item.background.includes("linear-gradient"))).toBe(true);

  expect(await page.locator(".dashboard-panel").count()).toBeGreaterThanOrEqual(4);
  await page.screenshot({ path: "test-results/dashboard-dark-mode.png", fullPage: true });
});

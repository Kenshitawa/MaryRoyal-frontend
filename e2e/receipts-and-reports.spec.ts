import { expect, test } from "@playwright/test";
import path from "node:path";
import { PDFDocument } from "pdf-lib";

test.describe("Dashboard, Receipts and Reports accessibility without server crash", () => {
  test.use({ storageState: path.resolve(__dirname, ".auth/director.json") });

  test("Director can open dashboard without server error", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText(/Good (morning|afternoon|evening)/);
    await expect(page.locator(".dashboard-stat")).toHaveCount(8);
    await expect(page.getByText("An error occurred")).toHaveCount(0);
  });

  test("Director can open official receipts register without server error", async ({ page }) => {
    const response = await page.goto("/receipts");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Official receipts" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Receipt summary" })).toBeVisible();
    await expect(page.getByText("An error occurred")).toHaveCount(0);
  });

  test("Director can open reports analytics without server error", async ({ page }) => {
    const response = await page.goto("/reports");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "School Analytics & Verified Reports" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Executive summary metrics" })).toBeVisible();
    await expect(page.getByText("An error occurred")).toHaveCount(0);
  });

  test("Director can open accounts page without crash", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => console.log("PAGE LOG:", msg.type(), msg.text()));
    page.on("pageerror", err => {
      console.log("PAGE ERROR:", err.message, err.stack);
      errors.push(err.message);
    });
    const response = await page.goto("/accounts");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText("User accounts");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("tbody tr, ul[aria-label='User accounts'] li").first()).toBeVisible({ timeout: 10000 });
    expect(errors).toEqual([]);
    await expect(page.getByText("An error occurred")).toHaveCount(0);
  });

  test("Receipt export endpoints return valid CSV and PDF", async ({ request }) => {
    const csvRes = await request.get("/api/receipts/export?format=csv");
    expect(csvRes.status()).toBe(200);
    expect(csvRes.headers()["content-type"]).toContain("text/csv");
    const csvText = await csvRes.text();
    expect(csvText).toContain("Receipt number");

    const pdfRes = await request.get("/api/receipts/export");
    expect(pdfRes.status()).toBe(200);
    expect(pdfRes.headers()["content-type"]).toBe("application/pdf");
    const pdfBytes = Buffer.from(await pdfRes.body());
    const pdfDoc = await PDFDocument.load(pdfBytes);
    expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});

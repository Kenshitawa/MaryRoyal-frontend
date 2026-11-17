import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

for (const width of [390, 1280]) {
  for (const role of ["director", "head_teacher", "secretary"]) {
    test.describe(`${role} learner navigation at ${width}px`, () => {
      test.use({ storageState: path.resolve(__dirname, `.auth/${role}.json`), viewport: { width, height: 844 } });
      test("opens the learner profile from the register and filtered search", async ({ page }) => {
        await page.goto("/learners");
        const profile = page.getByRole("link", { name: "View profile", exact: true }).filter({ visible: true }).first();
        await expect(profile).toBeVisible();
        const href = await profile.getAttribute("href");
        expect(href).toMatch(/^\/learners\/c[a-z0-9]+$/);
        await profile.click();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator("#attendance")).toBeVisible();

        await page.goBack();
        await expect(page).toHaveURL(/\/learners$/);
        const search = page.getByPlaceholder("Search by name, admission number, or grade…");
        await search.fill("NO-MATCH-MOBILE-REGRESSION");
        await expect(page.getByText("No learners found matching the search criteria.", { exact: true }).filter({ visible: true })).toBeVisible();
        await expect(page.getByRole("link", { name: "View profile", exact: true }).filter({ visible: true })).toHaveCount(0);
        await search.clear();
        await expect(profile).toBeVisible();
        await profile.click();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await expect(page.locator("main h1")).toBeVisible();
      });
    });
  }
}

test.describe("teacher academic-only learner access", () => {
  test.use({ storageState: path.resolve(__dirname, ".auth/teacher.json"), viewport: { width: 390, height: 844 } });

  test("shows assigned academic records without learner profiles or photos", async ({ page }) => {
    const sample = JSON.parse(fs.readFileSync(path.resolve(__dirname, ".auth/sample-records.json"), "utf8")) as Record<string, string>;
    await page.goto("/learners");
    await expect(page.getByRole("heading", { name: "Class learning records" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View profile", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Assigned class and learning area" }).click();
    await page.getByRole("option", { name: "Grade 4 · Mathematics" }).click();
    await expect(page.getByRole("heading", { name: "Achieng Otieno" })).toBeVisible();
    await expect(page.getByText("CBE assessment history")).toBeVisible();
    await expect(page.getByText("Learning strengths & support areas")).toBeVisible();

    const academicResponse = await page.evaluate(async () => {
      const response = await fetch("/api/learners/academics?grade=Grade%204&subject=Mathematics");
      return { status: response.status, payload: await response.json() };
    });
    expect(academicResponse.status).toBe(200);
    expect(Object.keys(academicResponse.payload.learners[0]).sort()).toEqual(["assessments", "assignments", "id", "name"]);
    expect(academicResponse.payload.learners[0].assessments[0]).not.toHaveProperty("learnerId");
    const deniedStatuses = await page.evaluate(async () => {
      const [directory, otherClass] = await Promise.all([
        fetch("/api/learners?take=1"),
        fetch("/api/learners/academics?grade=Grade%209&subject=Mathematics"),
      ]);
      return [directory.status, otherClass.status];
    });
    expect(deniedStatuses).toEqual([403, 403]);

    const photoStatus = await page.evaluate(async (id) => (await fetch(`/api/learners/${id}/photo`)).status, sample.teacherLearnerId);
    expect(photoStatus).toBe(403);
    await page.goto(`/learners/${sample.teacherLearnerId}`);
    await expect(page).toHaveURL(/\/learners$/);
    await expect(page.getByRole("heading", { name: "Class learning records" })).toBeVisible();
  });
});

for (const width of [390, 1280]) {
  for (const role of ["parent", "learner"]) {
    test.describe(`${role} direct learner profile at ${width}px`, () => {
      test.use({ storageState: path.resolve(__dirname, `.auth/${role}.json`), viewport: { width, height: 844 } });
      test("returns to the role home without learner-directory access", async ({ page }) => {
        const sample = JSON.parse(fs.readFileSync(path.resolve(__dirname, ".auth/sample-records.json"), "utf8")) as Record<string, string>;
        const id = role === "parent" ? sample.learnerId : sample.selfLearnerId;
        await page.goto(`/learners/${id}`);
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator('nav[aria-label="Breadcrumb"] a[href="/learners"]')).toHaveCount(0);
        await page.getByRole("button", { name: "Go back", exact: true }).filter({ visible: true }).click();
        await expect(page).toHaveURL(new RegExp(`${role === "parent" ? "/portal" : "/learning"}$`));
        await expect(page.locator("main h1")).toBeVisible();
      });
    });
  }

  test.describe(`secretary dirty admission navigation at ${width}px`, () => {
    test.use({ storageState: path.resolve(__dirname, ".auth/secretary.json"), viewport: { width, height: 844 } });
    test("preserves cancelled changes and asks once before confirmed document Back", async ({ page }) => {
      await page.goto("/admissions/new");
      await page.getByLabel("Full names").fill("Unsaved profile navigation regression");
      const warnings: string[] = [];
      let discard = false;
      page.on("dialog", async (dialog) => {
        warnings.push(dialog.type());
        if (discard) await dialog.accept();
        else await dialog.dismiss();
      });
      const back = page.getByRole("button", { name: "Go back", exact: true }).filter({ visible: true });
      await back.click();
      await expect(page).toHaveURL(/\/admissions\/new$/);
      await expect(page.getByLabel("Full names")).toHaveValue("Unsaved profile navigation regression");
      expect(warnings).toEqual(["confirm"]);
      discard = true;
      await back.click();
      await expect(page).toHaveURL(/\/learners$/);
      expect(warnings).toEqual(["confirm", "confirm"]);
    });
  });

  test.describe(`accountant learner privacy at ${width}px`, () => {
    test.use({ storageState: path.resolve(__dirname, ".auth/accountant.json"), viewport: { width, height: 844 } });
    test("shows identity and finance without private profile sections", async ({ page }) => {
      const sample = JSON.parse(fs.readFileSync(path.resolve(__dirname, ".auth/sample-records.json"), "utf8")) as Record<string, string>;
      await page.goto(`/learners/${sample.learnerId}`);
      await expect(page.locator("main h1")).toBeVisible();
      await expect(page.locator("#fees")).toBeVisible();
      for (const section of ["profile", "academics", "attendance", "talents", "guardians", "residence", "health", "documents", "discipline", "history"]) {
        await expect(page.locator(`main #${section}`)).toHaveCount(0);
      }
    });
  });
}

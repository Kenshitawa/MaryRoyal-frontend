import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const directorEmail = "director@maryroyal.ac.ke";
const directorPasswords = ["PortalTest2026!", "MaryRoyalTest2026!", "MaryRoyal2026!"];
const directorNewPassword = "PortalTest2026!";
const newUserEmail = `signout-${randomUUID()}@maryroyal.ac.ke`;
const newUserName = "Sign Out Test Teacher";
const permanentPassword = "OnboardTest2026!";
let temporaryPassword = "";

async function signIn(page: Page, email: string, passwords: string[]) {
  await page.goto("/");
  await page.locator('input[name="email"]').fill(email);
  for (const password of passwords) {
    await page.locator('input[name="password"]').fill(password);
    const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/login"));
    await page.getByRole("button", { name: "Sign in securely" }).click();
    const response = await responsePromise;
    if (response.ok()) {
      await page.waitForURL(/\/(change-password|dashboard)$/);
      return;
    }
    await expect(page.getByRole("button", { name: "Sign in securely" })).toBeEnabled();
  }
  throw new Error(`Could not sign in test account ${email}.`);
}

async function finishFirstTimeSetup(page: Page, password: string) {
  await page.locator('input[name="password"]').fill(password);
  await page.locator('input[name="confirmPassword"]').fill(password);
  await page.getByRole("button", { name: /Update password/ }).click();
  await page.waitForURL("**/dashboard");
}

async function confirmSignOut(page: Page) {
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL("http://127.0.0.1:3187/");
  expect((await page.request.post("/api/session/refresh")).status()).toBe(401);
}

test("new users see their identity at first sign-in and mobile sign-out clears the session", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, directorEmail, directorPasswords);
  if (page.url().endsWith("/change-password")) {
    const identity = page.getByRole("region", { name: "Your school account" });
    await expect(identity).toContainText("Mary Royal Director");
    await expect(identity).toContainText(directorEmail);
    await expect(identity).toContainText("DIRECTOR");
    await finishFirstTimeSetup(page, directorNewPassword);
  }

  const created = await page.request.post("/api/accounts", {
    data: { name: newUserName, email: newUserEmail, role: "TEACHER" },
  });
  expect(created.status()).toBe(201);
  const credentials = await created.json() as { temporaryPassword: string };
  temporaryPassword = credentials.temporaryPassword;
  expect(temporaryPassword.length).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("button", { name: "Sign out of Mary Royal School" }).click();
  await confirmSignOut(page);

  await signIn(page, newUserEmail, [temporaryPassword]);
  await expect(page).toHaveURL(/\/change-password$/);
  const identity = page.getByRole("region", { name: "Your school account" });
  await expect(identity).toContainText(newUserName);
  await expect(identity).toContainText(newUserEmail);
  await expect(identity).toContainText("TEACHER");
  await finishFirstTimeSetup(page, permanentPassword);

  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("button", { name: "Sign out of Mary Royal School" }).click();
  await confirmSignOut(page);
});

test("desktop profile sign-out clears the authenticated session", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, newUserEmail, [permanentPassword]);
  await page.locator('details > summary[aria-label="Open profile menu"]').click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await confirmSignOut(page);
});

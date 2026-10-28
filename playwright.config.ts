import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
const systemChrome = process.env.PLAYWRIGHT_CHROME_EXECUTABLE ?? (process.platform === "win32" && existsSync("C:/Program Files/Google/Chrome/Application/chrome.exe") ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : undefined);
export default defineConfig({ testDir: "./e2e", fullyParallel: false, reporter: "list", use: { baseURL: "http://127.0.0.1:3187", trace: "retain-on-failure", ...(systemChrome ? { launchOptions: { executablePath: systemChrome } } : {}) }, projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }], webServer: { command: "npm run start:e2e", url: "http://127.0.0.1:3187", reuseExistingServer: false, timeout: 120_000 } });

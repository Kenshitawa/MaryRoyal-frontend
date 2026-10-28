/**
 * Playwright global setup — regenerates Playwright storageState auth files
 * before any test run, so session cookies are always fresh.
 */
import { assertLocalTestDatabase, generateStorageStates } from "../scripts/generate-test-sessions";

export default async function globalSetup() {
  assertLocalTestDatabase();
  await generateStorageStates();
}

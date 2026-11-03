import { describe, expect, it } from "vitest";
import { assertLocalTestDatabase } from "../scripts/generate-test-sessions";

describe("Playwright session database guard", () => {
  it("allows only the isolated local E2E database", () => {
    expect(() => assertLocalTestDatabase("file:./round3-e2e.test.db", "1")).not.toThrow();
  });

  it("refuses an unset database or the normal development database", () => {
    expect(() => assertLocalTestDatabase(undefined, "1")).toThrow();
    expect(() => assertLocalTestDatabase("file:./dev.db", "1")).toThrow();
    expect(() => assertLocalTestDatabase("file:./round3-e2e.test.db", undefined)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import {
  accountsResponseSchema,
  guardianLinksResponseSchema,
  learnersResponseSchema,
} from "../src/lib/account-response-schemas";

describe("account screen API response contracts", () => {
  it("accepts the account directory response and rejects missing or malformed account arrays", () => {
    const account = {
      id: "user-1",
      name: "Jane Achieng",
      email: "jane@example.test",
      role: "TEACHER",
      suspended: false,
      suspensionReason: null,
      forcePasswordChange: false,
      failedLogins: 0,
    };

    expect(accountsResponseSchema.safeParse({ accounts: [account] }).success).toBe(true);
    expect(accountsResponseSchema.safeParse({ error: "Unexpected response" }).success).toBe(false);
    expect(accountsResponseSchema.safeParse({ accounts: [{ ...account, failedLogins: "0" }] }).success).toBe(false);
  });

  it("accepts the learner and family-link response shapes consumed by the account screen", () => {
    expect(learnersResponseSchema.safeParse({
      learners: [{ id: "learner-1", name: "Sam Otieno", admissionNo: "MRS-001", grade: "Grade 1" }],
    }).success).toBe(true);
    expect(guardianLinksResponseSchema.safeParse({
      links: [{
        id: "link-1",
        user: { name: "Jane Achieng", email: "jane@example.test", role: "PARENT" },
        learner: { name: "Sam Otieno", admissionNo: "MRS-001", grade: "Grade 1" },
        relation: "Parent",
      }],
    }).success).toBe(true);
    expect(learnersResponseSchema.safeParse({ learners: null }).success).toBe(false);
    expect(guardianLinksResponseSchema.safeParse({}).success).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { cbcLevel, feeBalance } from "../src/lib/grading";
import { can } from "../src/lib/permissions";
import { Role } from "@prisma/client";
describe("school rules", () => {
 it("maps every CBC score boundary to the requested eight-level scale", () => {
  expect([100, 90, 89, 75, 74, 58, 57, 41, 40, 31, 30, 21, 20, 10, 9, 0].map(cbcLevel))
   .toEqual(["EE1", "EE1", "EE2", "EE2", "ME1", "ME1", "ME2", "ME2", "AE1", "AE1", "AE2", "AE2", "BE1", "BE1", "BE2", "BE2"]);
 });
 it("rejects marks outside the assessment range", () => { expect(() => cbcLevel(-1)).toThrow(RangeError); expect(() => cbcLevel(101)).toThrow(RangeError); });
 it("never exposes finance to learners", () => { expect(can(Role.LEARNER, "finance", "view")).toBe(false); });
 it("calculates carried fee balance", () => { expect(feeBalance(10000, 3000, 500)).toBe(6500); });
});

import { describe, expect, it } from "vitest";
import { cbcLevel, feeBalance } from "../src/lib/grading";
import { can } from "../src/lib/permissions";
import { Role } from "@prisma/client";
describe("school rules", () => {
 it("maps CBC marks", () => { expect(cbcLevel(90)).toBe("EE"); expect(cbcLevel(65)).toBe("ME"); expect(cbcLevel(45)).toBe("AE"); expect(cbcLevel(20)).toBe("BE"); });
 it("never exposes finance to learners", () => { expect(can(Role.LEARNER, "finance", "view")).toBe(false); });
 it("calculates carried fee balance", () => { expect(feeBalance(10000, 3000, 500)).toBe(6500); });
});

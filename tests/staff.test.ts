import { describe, expect, it } from "vitest";
import { Role } from "@prisma/client";
import {
  staffPersonalSchema,
  staffEmergencyContactSchema,
  staffStatutorySchema,
  kenyanPhoneRegex,
} from "../src/lib/staff-validation";
import {
  canManageStaffTarget,
  canDeleteStaffAccount,
  canSuspendStaffAccount,
  canViewStaffStatutory,
  canEditStaffStatutory,
} from "../src/lib/permissions";
import { stripStaffStatutoryFields } from "../src/lib/staff-sanitization";

describe("Staff Validation & Kenyan Identifiers", () => {
  it("validates Kenyan phone numbers in international and national formats", () => {
    expect(kenyanPhoneRegex.test("+254712345678")).toBe(true);
    expect(kenyanPhoneRegex.test("+254112345678")).toBe(true);
    expect(kenyanPhoneRegex.test("0712345678")).toBe(true);
    expect(kenyanPhoneRegex.test("0112345678")).toBe(true);

    expect(kenyanPhoneRegex.test("12345678")).toBe(false);
    expect(kenyanPhoneRegex.test("+1234567890")).toBe(false);
    expect(kenyanPhoneRegex.test("0812345678")).toBe(false);
  });

  it("validates personal bio fields", () => {
    const valid = staffPersonalSchema.safeParse({
      name: "Mildred Achieng",
      email: "MILDRED@MaryRoyal.AC.KE",
      phone: "+254712345678",
      gender: "Female",
      nationality: "Kenyan",
      county: "Kisumu",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.email).toBe("mildred@maryroyal.ac.ke");
    }

    const invalid = staffPersonalSchema.safeParse({
      name: "M",
      email: "not-an-email",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates emergency contact with next of kin flag", () => {
    const valid = staffEmergencyContactSchema.safeParse({
      fullName: "Otieno Silas",
      relationship: "Spouse",
      phone: "+254722123456",
      isNextOfKin: true,
    });
    expect(valid.success).toBe(true);
  });

  it("validates statutory and payroll schema", () => {
    const valid = staffStatutorySchema.safeParse({
      kraPin: "A012345678Z",
      nssfNumber: "12345678",
      shaNumber: "SHA-001234",
      bankName: "Kenya Commercial Bank",
      bankAccountNumber: "1122334455",
    });
    expect(valid.success).toBe(true);
  });
});

describe("Staff Account Authorization Matrix", () => {
  it("authorizes Director to manage all staff roles", () => {
    for (const r of [
      Role.HEAD_TEACHER,
      Role.DEPUTY,
      Role.SECRETARY,
      Role.ACCOUNTANT,
      Role.TEACHER,
      Role.WELFARE_CHAIR,
      Role.NON_TEACHING_STAFF,
    ]) {
      expect(canManageStaffTarget(Role.DIRECTOR, r)).toBe(true);
      expect(canEditStaffStatutory(Role.DIRECTOR, r)).toBe(true);
    }
    expect(canDeleteStaffAccount(Role.DIRECTOR)).toBe(true);
    expect(canSuspendStaffAccount(Role.DIRECTOR)).toBe(true);
    expect(canViewStaffStatutory(Role.DIRECTOR)).toBe(true);
  });

  it("authorizes Head Teacher for subordinate staff only, denying peer and superior management", () => {
    // Permitted targets
    expect(canManageStaffTarget(Role.HEAD_TEACHER, Role.DEPUTY)).toBe(true);
    expect(canManageStaffTarget(Role.HEAD_TEACHER, Role.SECRETARY)).toBe(true);
    expect(canManageStaffTarget(Role.HEAD_TEACHER, Role.ACCOUNTANT)).toBe(true);
    expect(canManageStaffTarget(Role.HEAD_TEACHER, Role.TEACHER)).toBe(true);

    // Forbidden targets: Director or another Head Teacher
    expect(canManageStaffTarget(Role.HEAD_TEACHER, Role.DIRECTOR)).toBe(false);
    expect(canManageStaffTarget(Role.HEAD_TEACHER, Role.HEAD_TEACHER)).toBe(false);

    // Head Teacher cannot delete or suspend
    expect(canDeleteStaffAccount(Role.HEAD_TEACHER)).toBe(false);
    expect(canSuspendStaffAccount(Role.HEAD_TEACHER)).toBe(false);

    // Head Teacher can view statutory for permitted staff
    expect(canViewStaffStatutory(Role.HEAD_TEACHER)).toBe(true);
    expect(canEditStaffStatutory(Role.HEAD_TEACHER, Role.TEACHER)).toBe(true);
    expect(canEditStaffStatutory(Role.HEAD_TEACHER, Role.DIRECTOR)).toBe(false);
    expect(canEditStaffStatutory(Role.HEAD_TEACHER, Role.HEAD_TEACHER)).toBe(false);
  });

  it("allows Accountant to view statutory details for payroll but not edit", () => {
    expect(canViewStaffStatutory(Role.ACCOUNTANT)).toBe(true);
    expect(canEditStaffStatutory(Role.ACCOUNTANT, Role.TEACHER)).toBe(false);
    expect(canManageStaffTarget(Role.ACCOUNTANT, Role.TEACHER)).toBe(false);
    expect(canDeleteStaffAccount(Role.ACCOUNTANT)).toBe(false);
  });

  it("denies Teachers, Deputy, Secretary, Parents, and Learners from statutory details", () => {
    for (const r of [
      Role.TEACHER,
      Role.DEPUTY,
      Role.SECRETARY,
      Role.PARENT,
      Role.LEARNER,
      Role.NON_TEACHING_STAFF,
    ]) {
      expect(canViewStaffStatutory(r)).toBe(false);
      expect(canEditStaffStatutory(r, Role.TEACHER)).toBe(false);
      expect(canManageStaffTarget(r, Role.TEACHER)).toBe(false);
      expect(canDeleteStaffAccount(r)).toBe(false);
    }
  });

  it("safely strips restricted statutory fields from profiles when user is unauthorized", () => {
    const fullProfile = {
      id: "prof-1",
      userId: "usr-1",
      department: "Mathematics",
      employmentType: "Permanent",
      kraPin: "A012345678Z",
      nssfNumber: "12345678",
      shaNumber: "SHA-001234",
      bankName: "KCB",
      bankAccountName: "Mildred Achieng",
      bankAccountNumber: "1122334455",
      bankBranch: "Kisumu",
    };

    const sanitized = stripStaffStatutoryFields(fullProfile);
    expect(sanitized).toHaveProperty("department", "Mathematics");
    expect(sanitized).toHaveProperty("employmentType", "Permanent");
    expect(sanitized).not.toHaveProperty("kraPin");
    expect(sanitized).not.toHaveProperty("nssfNumber");
    expect(sanitized).not.toHaveProperty("shaNumber");
    expect(sanitized).not.toHaveProperty("bankName");
    expect(sanitized).not.toHaveProperty("bankAccountNumber");
  });

  it("handles accounts with null or empty bio/statutory data gracefully", () => {
    const emptyProfile = {
      id: "prof-2",
      userId: "usr-2",
      department: null,
      employmentType: null,
      kraPin: null,
      nssfNumber: null,
      shaNumber: null,
      bankName: null,
      bankAccountName: null,
      bankAccountNumber: null,
      bankBranch: null,
    };

    const sanitized = stripStaffStatutoryFields(emptyProfile);
    expect(sanitized.id).toBe("prof-2");
    expect(sanitized.department).toBeNull();
    expect(sanitized).not.toHaveProperty("kraPin");
    expect(sanitized).not.toHaveProperty("bankName");
  });
});

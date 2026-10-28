import { describe, expect, it } from "vitest";
import { getMobileNavigation, getSectionForPath, RoleMobileNav } from "../src/lib/navigation";

describe("Mobile Navigation (4 Tabs + More per role)", () => {
  const roles = [
    "DIRECTOR",
    "HEAD_TEACHER",
    "DEPUTY",
    "SECRETARY",
    "ACCOUNTANT",
    "TEACHER",
    "PARENT",
    "LEARNER",
  ];

  it("provides exactly 4 primary tabs for every role", () => {
    for (const role of roles) {
      const nav: RoleMobileNav = getMobileNavigation(role);
      expect(nav.primary).toHaveLength(4);
      for (const item of nav.primary) {
        expect(item.label).toBeTruthy();
        expect(item.href).toBeTruthy();
        expect(item.icon).toBeDefined();
      }
    }
  });

  it("configures exact required primary tabs for Director", () => {
    const nav = getMobileNavigation("DIRECTOR");
    const labels = nav.primary.map((t) => t.label);
    expect(labels).toEqual(["Home", "Learners", "Finance", "Staff"]);
  });

  it("configures exact required primary tabs for Head Teacher", () => {
    const nav = getMobileNavigation("HEAD_TEACHER");
    const labels = nav.primary.map((t) => t.label);
    expect(labels).toEqual(["Home", "Learners", "Attendance", "Complaints"]);
  });

  it("configures exact required primary tabs for Deputy", () => {
    const nav = getMobileNavigation("DEPUTY");
    const labels = nav.primary.map((t) => t.label);
    expect(labels).toEqual(["Home", "Attendance", "Exams", "Timetable"]);
  });

  it("configures exact required primary tabs for Secretary", () => {
    const nav = getMobileNavigation("SECRETARY");
    const labels = nav.primary.map((t) => t.label);
    expect(labels).toEqual(["Home", "Admissions", "Learners", "Fees"]);
  });

  it("configures exact required primary tabs for Accountant", () => {
    const nav = getMobileNavigation("ACCOUNTANT");
    const labels = nav.primary.map((t) => t.label);
    expect(labels).toEqual(["Home", "Invoices", "Payments", "Arrears"]);
  });

  it("names the app bar after the page rather than one of its tab siblings", () => {
    expect(getSectionForPath("/finance", "ACCOUNTANT")).toBe("Finance");
    expect(getSectionForPath("/finance", "SECRETARY")).toBe("Fees");
    expect(getSectionForPath("/portal", "PARENT")).toBe("Home");
    expect(getSectionForPath("/learning", "LEARNER")).toBe("Home");
  });

  it("configures exact required primary tabs for Teacher", () => {
    const nav = getMobileNavigation("TEACHER");
    const labels = nav.primary.map((t) => t.label);
    expect(labels).toEqual(["Home", "Attendance", "Marks", "My Classes"]);
  });

  it("configures exact required primary tabs for Parent", () => {
    const nav = getMobileNavigation("PARENT");
    const labels = nav.primary.map((t) => t.label);
    expect(labels).toEqual(["Home", "Results", "Fees", "Messages"]);
  });

  it("configures exact required primary tabs for Learner", () => {
    const nav = getMobileNavigation("LEARNER");
    const labels = nav.primary.map((t) => t.label);
    expect(labels).toEqual(["Home", "Homework", "Results", "My Learning"]);
  });

  it("enforces that forbidden pages never appear in Accountant mobile navigation", () => {
    const nav = getMobileNavigation("ACCOUNTANT");
    const allHrefs = [
      ...nav.primary.map((t) => t.href),
      ...nav.moreCategories.flatMap((c) => c.items.map((i) => i.href)),
    ];
    // Accountant must NOT see grades, discipline, attendance admin, complaints or staff
    expect(allHrefs).not.toContain("/assessments");
    expect(allHrefs).not.toContain("/attendance");
    expect(allHrefs).not.toContain("/complaints");
    expect(allHrefs).not.toContain("/staff");
    expect(allHrefs).not.toContain("/accounts");
  });

  it("enforces that forbidden pages never appear in Secretary mobile navigation", () => {
    const nav = getMobileNavigation("SECRETARY");
    const allHrefs = [
      ...nav.primary.map((t) => t.href),
      ...nav.moreCategories.flatMap((c) => c.items.map((i) => i.href)),
    ];
    // Secretary must NOT see assessments, attendance admin, accounts, audit or complaints
    expect(allHrefs).not.toContain("/assessments");
    expect(allHrefs).not.toContain("/attendance");
    expect(allHrefs).not.toContain("/accounts");
    expect(allHrefs).not.toContain("/audit");
    expect(allHrefs).not.toContain("/complaints");
  });

  it("enforces that forbidden pages never appear in Parent and Learner navigation", () => {
    const parentNav = getMobileNavigation("PARENT");
    const parentHrefs = [
      ...parentNav.primary.map((t) => t.href),
      ...parentNav.moreCategories.flatMap((c) => c.items.map((i) => i.href)),
    ];
    expect(parentHrefs).not.toContain("/staff");
    expect(parentHrefs).not.toContain("/accounts");
    expect(parentHrefs).not.toContain("/audit");

    const learnerNav = getMobileNavigation("LEARNER");
    const learnerHrefs = [
      ...learnerNav.primary.map((t) => t.href),
      ...learnerNav.moreCategories.flatMap((c) => c.items.map((i) => i.href)),
    ];
    expect(learnerHrefs).not.toContain("/finance");
    expect(learnerHrefs).not.toContain("/staff");
    expect(learnerHrefs).not.toContain("/accounts");
    expect(learnerHrefs).not.toContain("/admissions");
  });
});

import { describe, expect, it } from "vitest";
import {
  activeSubject,
  CURRICULUM_GRADES,
  CURRICULUM_SUBJECTS,
  gradeOptions,
  sortGrades,
  subjectOptions,
  tidyValues,
} from "../src/lib/curriculum";

describe("Curriculum option builders", () => {
  it("never returns an empty grade list", () => {
    expect(gradeOptions([])).toEqual([...CURRICULUM_GRADES]);
    expect(gradeOptions([], { grades: [], subjects: [] })).toEqual([...CURRICULUM_GRADES]);
  });

  it("prefers the teacher's allocated grades and orders them by class", () => {
    const teaching = [
      { grade: "Grade 6", subject: "Mathematics" },
      { grade: "PP1", subject: "Language" },
      { grade: "Grade 6", subject: "English" },
    ];
    expect(gradeOptions(teaching)).toEqual(["PP1", "Grade 6"]);
  });

  it("uses the school-wide catalogue for leaders without allocations", () => {
    expect(gradeOptions([], { grades: ["Grade 9", "Grade 2"], subjects: ["Science"] })).toEqual(["Grade 2", "Grade 9"]);
    expect(subjectOptions("Grade 2", [], { grades: [], subjects: ["Science", "Kiswahili"] })).toEqual(["Science", "Kiswahili"]);
  });

  it("falls back to all of a teacher's subjects when a class has no match", () => {
    const teaching = [{ grade: "Grade 4", subject: "English" }];
    expect(subjectOptions("Grade 9", teaching)).toEqual(["English"]);
  });

  it("drops blank values that would render an empty dropdown", () => {
    expect(tidyValues(["", "  ", "Grade 4", "Grade 4", null, undefined])).toEqual(["Grade 4"]);
    expect(gradeOptions([{ grade: "", subject: "" }])).toEqual([...CURRICULUM_GRADES]);
    expect(subjectOptions("Grade 4", [{ grade: "Grade 4", subject: " " }])).toEqual([...CURRICULUM_SUBJECTS]);
  });

  it("sorts unknown grades after the national classes", () => {
    expect(sortGrades(["Zeta", "Grade 3", "PP2", "Alpha"])).toEqual(["PP2", "Grade 3", "Alpha", "Zeta"]);
  });

  it("keeps a valid subject and otherwise selects the first option", () => {
    expect(activeSubject("English", ["English", "Kiswahili"])).toBe("English");
    expect(activeSubject("Physics", ["English", "Kiswahili"])).toBe("English");
    expect(activeSubject("", [])).toBe("");
  });
});

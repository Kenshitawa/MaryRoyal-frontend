export const CURRICULUM_GRADES = [
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
] as const;

export const CURRICULUM_SUBJECTS = [
  "Mathematics",
  "English",
  "Kiswahili",
  "Integrated Science",
  "Social Studies",
  "Religious Education",
  "Creative Activities",
  "Creative Arts",
  "Agriculture",
  "Agriculture & Nutrition",
  "Environmental Activities",
  "Pre-Technical Studies",
  "English Activities",
  "Language Activities",
  "Mathematics Activities",
  "Religious Education Activities",
  "Science & Technology",
  "Creative Arts and Sports",
  "Indigenous Language",
  "Arabic",
  "French",
  "German",
  "Mandarin",
  "CRE",
  "HRE",
  "IRE",
] as const;

const PREPRIMARY_AREAS = ["Language Activities", "Mathematics Activities", "Creative Arts", "Environmental Activities", "Religious Education Activities"];
const LOWER_PRIMARY_AREAS = ["English Activities", "Kiswahili", "Mathematics", "Environmental Activities", "Hygiene and Nutrition Activities", "Creative Activities", "Religious Education Activities", "Indigenous Languages"];
const UPPER_PRIMARY_AREAS = ["English", "Kiswahili", "Mathematics", "Agriculture & Nutrition", "Social Studies", "Creative Activities", "Science & Technology", "Religious Education", "Indigenous Language", "Arabic", "French", "German", "Mandarin"];
const JUNIOR_SCHOOL_AREAS = ["Agriculture", "Pre-Technical Studies", "Creative Arts and Sports", "Religious Education", "Integrated Science", "Social Studies", "Mathematics", "English", "Kiswahili", "Indigenous Language", "Arabic", "French", "German", "Mandarin"];

export function curriculumSubjectsForGrade(grade: string): string[] {
  if (grade === "PP1" || grade === "PP2") return [...PREPRIMARY_AREAS];
  const match = /^Grade (\d+)$/.exec(grade);
  if (!match) return [...CURRICULUM_SUBJECTS];
  const level = Number(match[1]);
  if (level >= 1 && level <= 3) return [...LOWER_PRIMARY_AREAS];
  if (level >= 4 && level <= 6) return [...UPPER_PRIMARY_AREAS];
  if (level >= 7 && level <= 9) return [...JUNIOR_SCHOOL_AREAS];
  return [...CURRICULUM_SUBJECTS];
}

export type TeachingAssignment = { grade: string; subject: string };
export type CurriculumCatalog = { grades: readonly string[]; subjects: readonly string[] };

export function tidyValues(values: ReadonlyArray<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = (value ?? "").trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

const GRADE_ORDER = new Map<string, number>(CURRICULUM_GRADES.map((grade, index) => [grade, index]));

export function sortGrades(values: ReadonlyArray<string>): string[] {
  return [...values].sort((left, right) => {
    const leftIndex = GRADE_ORDER.get(left);
    const rightIndex = GRADE_ORDER.get(right);
    if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
    if (leftIndex !== undefined) return -1;
    if (rightIndex !== undefined) return 1;
    return left.localeCompare(right, "en", { numeric: true });
  });
}

// Dropdown options must never be empty: teacher allocations first, then the
// school-wide catalogue from the database, then the national CBE defaults.
export function gradeOptions(teaching: ReadonlyArray<TeachingAssignment>, catalog?: CurriculumCatalog): string[] {
  const assigned = tidyValues(teaching.map((item) => item.grade));
  if (assigned.length) return sortGrades(assigned);
  const school = tidyValues(catalog?.grades ?? []);
  return sortGrades([...new Set([...CURRICULUM_GRADES, ...school])]);
}

export function subjectOptions(
  grade: string,
  teaching: ReadonlyArray<TeachingAssignment>,
  catalog?: CurriculumCatalog
): string[] {
  const sameGrade = tidyValues(teaching.filter((item) => item.grade === grade).map((item) => item.subject));
  if (sameGrade.length) return sameGrade;
  const teacherSubjects = tidyValues(teaching.map((item) => item.subject));
  if (teacherSubjects.length) return teacherSubjects;
  const gradeDefaults = curriculumSubjectsForGrade(grade);
  const school = tidyValues(catalog?.subjects ?? []);
  return school.length ? [...new Set([...gradeDefaults, ...school])] : gradeDefaults;
}

export function activeSubject(current: string, options: ReadonlyArray<string>): string {
  return options.includes(current) ? current : options[0] ?? "";
}

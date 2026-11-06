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
  "CRE",
  "Creative Arts",
  "Agriculture",
  "Environmental Activities",
  "Pre-Technical Studies",
] as const;

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
  if (school.length) return sortGrades(school);
  return [...CURRICULUM_GRADES];
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
  const school = tidyValues(catalog?.subjects ?? []);
  if (school.length) return school;
  return [...CURRICULUM_SUBJECTS];
}

export function activeSubject(current: string, options: ReadonlyArray<string>): string {
  return options.includes(current) ? current : options[0] ?? "";
}

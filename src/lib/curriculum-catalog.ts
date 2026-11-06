import { db } from "@/lib/db";
import { sortGrades, tidyValues, type CurriculumCatalog } from "@/lib/curriculum";

export async function loadCurriculumCatalog(): Promise<CurriculumCatalog> {
  const [learners, assignments] = await Promise.all([
    db.learner.findMany({ where: { archivedAt: null }, select: { grade: true }, distinct: ["grade"] }),
    db.teacherAssignment.findMany({ select: { subject: true }, distinct: ["subject"] }),
  ]);

  return {
    grades: sortGrades(tidyValues(learners.map((learner) => learner.grade))),
    subjects: tidyValues(assignments.map((assignment) => assignment.subject)),
  };
}

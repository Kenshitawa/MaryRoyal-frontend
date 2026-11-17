import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true },
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const querySchema = z.object({
  grade: z.string().trim().min(2).max(20),
  subject: z.string().trim().min(2).max(60),
});

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (user.role !== "TEACHER" || !canInScope(user.role, "learners", "view", "assigned")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Choose an assigned class and learning area." }, { status: 400 });

  const assignment = await db.teacherAssignment.findUnique({
    where: { teacherId_grade_subject: { teacherId: user.id, ...parsed.data } },
    select: { id: true },
  });
  if (!assignment) return NextResponse.json({ error: "This class and learning area are outside your teaching assignment." }, { status: 403 });

  const classLearners = await db.learner.findMany({
    where: { grade: parsed.data.grade, archivedAt: null, admissionStatus: "APPROVED" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 1000,
  });
  const learnerIds = classLearners.map((learner) => learner.id);
  await db.auditEvent.create({
    data: {
      actorId: user.id,
      action: "ASSIGNED_CLASS_ACADEMIC_RECORDS_VIEWED",
      entity: "LearnerAcademicRoster",
      entityId: assignment.id,
    },
  });
  if (learnerIds.length === 0) return NextResponse.json({ learners: [] });

  const [assessments, classAssignments] = await Promise.all([
    db.assessment.findMany({
      where: {
        learnerId: { in: learnerIds },
        subject: parsed.data.subject,
        OR: [
          { status: "RELEASED" },
          { enteredById: user.id, status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } },
        ],
      },
      select: { id: true, learnerId: true, score: true, term: true, strand: true, competency: true, status: true },
      orderBy: [{ term: "desc" }, { createdAt: "desc" }],
    }),
    db.assignment.findMany({
      where: { grade: parsed.data.grade, subject: parsed.data.subject, teacherId: user.id },
      select: {
        id: true,
        title: true,
        dueAt: true,
        maxScore: true,
        submissions: {
          where: { learnerId: { in: learnerIds } },
          select: { learnerId: true, score: true, status: true, submittedAt: true },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
  ]);
  return NextResponse.json({
    learners: classLearners.map((learner) => ({
      ...learner,
      assessments: assessments
        .filter((assessment) => assessment.learnerId === learner.id)
        .map((assessment) => ({
          id: assessment.id,
          score: assessment.score,
          term: assessment.term,
          strand: assessment.strand,
          competency: assessment.competency,
          status: assessment.status,
        })),
      assignments: classAssignments.map((item) => {
        const { submissions, ...task } = item;
        const submission = submissions.find((row) => row.learnerId === learner.id);
        return {
          ...task,
          submission: submission
            ? { score: submission.score, status: submission.status, submittedAt: submission.submittedAt }
            : null,
        };
      }),
    })),
  });
}

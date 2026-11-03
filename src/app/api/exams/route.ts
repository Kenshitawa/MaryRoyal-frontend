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
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const examSessionSchema = z.object({
  name: z.string().trim().min(3).max(100),
  term: z.string().regex(/^\d{4} Term [123]$/),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED", "PUBLISHED"]).default("DRAFT"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  marksOpenAt: z.string().optional(),
  marksCloseAt: z.string().optional(),
  classes: z.array(z.string().trim()).min(1),
  subjects: z.array(z.string().trim()).min(1),
  timetable: z.array(z.object({
    date: z.string(),
    time: z.string(),
    grade: z.string(),
    subject: z.string(),
    room: z.string().optional(),
    invigilator: z.string().optional()
  })).default([])
});

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const schoolWide = canInScope(user.role, "examSessions", "view", "school");
  const assignedOnly = !schoolWide && canInScope(user.role, "examSessions", "view", "assigned");
  if (!schoolWide && !assignedOnly) {
    await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "ExamSession" } });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;

  // Assigned-scope readers only get exam sessions that cover one of their own classes.
  const assignedGrades = assignedOnly
    ? (await db.teacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true } })).map((row) => row.grade)
    : null;

  const exams = await db.examSession.findMany({
    where,
    include: {
      createdBy: { select: { id: true, name: true, role: true } },
      _count: { select: { assessments: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  const visible = exams
    .map((exam) => {
      let classes: string[] = [];
      let subjects: string[] = [];
      try { classes = JSON.parse(exam.classesJson); } catch {}
      try { subjects = JSON.parse(exam.subjectsJson); } catch {}
      return { exam, classes, subjects };
    })
    .filter(({ classes }) => !assignedGrades || classes.some((grade) => assignedGrades.includes(grade)));

  // Calculate submission progress per class/subject for leadership
  const activeExamsWithProgress = await Promise.all(
    visible.map(async ({ exam, classes, subjects }) => {
      // Count total expected marks vs submitted
      const learnerCount = await db.learner.count({
        where: { grade: { in: classes }, archivedAt: null }
      });
      const expectedMarks = learnerCount * subjects.length;
      const submittedMarks = exam._count.assessments;

      return {
        ...exam,
        classes,
        subjects,
        expectedMarks,
        submittedMarks,
        progressPercent: expectedMarks > 0 ? Math.round((submittedMarks / expectedMarks) * 100) : 0
      };
    })
  );

  return NextResponse.json({ exams: activeExamsWithProgress });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "examSessions", "create", "school")) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "ExamSession" }
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = examSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check exam name, term, classes, and subjects." }, { status: 400 });
  }

  const { name, term, status, startDate, endDate, marksOpenAt, marksCloseAt, classes, subjects, timetable } = parsed.data;

  const created = await db.$transaction(async (tx) => {
    // If activating this exam, we keep status active
    const exam = await tx.examSession.create({
      data: {
        name,
        term,
        status,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        marksOpenAt: marksOpenAt ? new Date(marksOpenAt) : null,
        marksCloseAt: marksCloseAt ? new Date(marksCloseAt) : null,
        classesJson: JSON.stringify(classes),
        subjectsJson: JSON.stringify(subjects),
        timetableJson: JSON.stringify(timetable),
        createdById: user.id
      }
    });

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "EXAM_SESSION_CREATED",
        entity: "ExamSession",
        entityId: exam.id
      }
    });

    return exam;
  });

  return NextResponse.json({ exam: created }, { status: 201 });
}

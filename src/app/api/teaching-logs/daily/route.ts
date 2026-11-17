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

function nairobiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

const lessonSchema = z.object({
  grade: z.string().trim().min(2).max(20),
  subject: z.string().trim().min(2).max(60),
  status: z.enum(["DONE", "MISSED"]),
  notes: z.string().trim().max(300).optional(),
});
const submitSchema = z.object({ lessons: z.array(lessonSchema).min(1).max(100) });

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const teacher = user.role === "TEACHER";
  if (!canInScope(user.role, "teachingLogs", "view", teacher ? "assigned" : "school")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = nairobiDate();
  const weekStart = new Date(`${today}T00:00:00.000Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const startDate = weekStart.toISOString().slice(0, 10);
  const [assignments, entries] = await Promise.all([
    teacher
      ? db.teacherAssignment.findMany({
          where: { teacherId: user.id },
          select: { grade: true, subject: true },
          orderBy: [{ grade: "asc" }, { subject: "asc" }],
        })
      : Promise.resolve([]),
    db.dailyTeachingLog.findMany({
      where: {
        ...(teacher ? { teacherId: user.id } : {}),
        lessonDate: { gte: startDate, lte: today },
      },
      include: { teacher: { select: { id: true, name: true } } },
      orderBy: [{ lessonDate: "desc" }, { createdAt: "desc" }],
      take: 1000,
    }),
  ]);
  return NextResponse.json({ today, assignments, entries });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "teachingLogs", "create", "assigned")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Select a status for each lesson." }, { status: 400 });

  const keys = parsed.data.lessons.map(({ grade, subject }) => `${grade}\u0000${subject}`);
  if (new Set(keys).size !== keys.length) return NextResponse.json({ error: "A class and subject can only appear once." }, { status: 400 });

  const assigned = await db.teacherAssignment.findMany({
    where: { teacherId: user.id },
    select: { grade: true, subject: true },
  });
  const assignmentKeys = new Set(assigned.map(({ grade, subject }) => `${grade}\u0000${subject}`));
  if (parsed.data.lessons.some(({ grade, subject }) => !assignmentKeys.has(`${grade}\u0000${subject}`))) {
    return NextResponse.json({ error: "A class and subject is outside your teaching assignment." }, { status: 403 });
  }

  const lessonDate = nairobiDate();
  const saved = await db.$transaction(async (tx) => {
    const rows = [];
    for (const lesson of parsed.data.lessons) {
      const row = await tx.dailyTeachingLog.upsert({
        where: {
          teacherId_grade_subject_lessonDate: {
            teacherId: user.id,
            grade: lesson.grade,
            subject: lesson.subject,
            lessonDate,
          },
        },
        create: { ...lesson, teacherId: user.id, lessonDate },
        update: { status: lesson.status, notes: lesson.notes },
      });
      rows.push(row);
      await tx.auditEvent.create({
        data: { actorId: user.id, action: `DAILY_LESSON_${lesson.status}`, entity: "DailyTeachingLog", entityId: row.id },
      });
    }
    return rows;
  });
  return NextResponse.json({ entries: saved }, { status: 201 });
}

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
const scheduleSchema = z.array(z.object({ day: z.string(), grade: z.string(), subject: z.string(), teacherId: z.string().optional(), period: z.number().optional(), time: z.string().optional() }));

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
  const weekday = new Intl.DateTimeFormat("en-KE", { weekday: "long", timeZone: "Africa/Nairobi" }).format(new Date());
  const [timetable, entries] = await Promise.all([
    teacher ? db.schoolTimetable.findFirst({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, select: { scheduleJson: true } }) : Promise.resolve(null),
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
  let assignments: Array<{ grade: string; subject: string; period?: number; time?: string }> = [];
  if (teacher && timetable) {
    try {
      const parsed = scheduleSchema.safeParse(JSON.parse(timetable.scheduleJson));
      if (parsed.success) {
        const unique = new Map<string, (typeof parsed.data)[number]>();
        for (const slot of parsed.data) {
          if (slot.day.toLowerCase() !== weekday.toLowerCase() || slot.teacherId !== user.id) continue;
          const key = `${slot.grade}\u0000${slot.subject}`;
          if (!unique.has(key)) unique.set(key, slot);
        }
        assignments = [...unique.values()].map(({ grade, subject, period, time }) => ({ grade, subject, period, time }));
      }
    } catch { /* Malformed legacy timetable does not create fabricated lessons. */ }
  }
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

  const timetable = await db.schoolTimetable.findFirst({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, select: { scheduleJson: true } });
  let scheduledKeys = new Set<string>();
  if (timetable) {
    try {
      const parsedSchedule = scheduleSchema.safeParse(JSON.parse(timetable.scheduleJson));
      if (parsedSchedule.success) {
        const weekday = new Intl.DateTimeFormat("en-KE", { weekday: "long", timeZone: "Africa/Nairobi" }).format(new Date());
        scheduledKeys = new Set(parsedSchedule.data.filter((slot) => slot.day.toLowerCase() === weekday.toLowerCase() && slot.teacherId === user.id).map((slot) => `${slot.grade}\u0000${slot.subject}`));
      }
    } catch { /* No valid timetable means no lessons can be submitted. */ }
  }
  if (parsed.data.lessons.some(({ grade, subject }) => !scheduledKeys.has(`${grade}\u0000${subject}`))) {
    return NextResponse.json({ error: "A class and subject is not on your published timetable for today." }, { status: 403 });
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

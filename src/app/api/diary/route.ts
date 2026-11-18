import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

const writers = ["DIRECTOR", "HEAD_TEACHER", "SECRETARY", "TEACHER"] as const;

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

async function teacherGrades(userId: string) {
  const [classes, subjects] = await Promise.all([
    db.classTeacherAssignment.findMany({ where: { teacherId: userId }, select: { grade: true } }),
    db.teacherAssignment.findMany({ where: { teacherId: userId }, select: { grade: true } }),
  ]);
  return [...new Set([...classes, ...subjects].map((row) => row.grade))];
}

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const scope = user.role === "PARENT" ? "linked" : user.role === "TEACHER" ? "assigned" : "school";
  if (!canInScope(user.role, "diary", "view", scope)) {
    await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "Diary" } });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let learnerIds: string[] | undefined;
  let grades: string[] | undefined;
  if (user.role === "PARENT") {
    const links = await db.guardianLink.findMany({ where: { userId: user.id, learner: { archivedAt: null, admissionStatus: "APPROVED" } }, select: { learnerId: true } });
    learnerIds = links.map((link) => link.learnerId);
  } else if (user.role === "TEACHER") {
    grades = await teacherGrades(user.id);
  }

  const entries = await db.diaryEntry.findMany({
    where: {
      learner: { archivedAt: null, admissionStatus: "APPROVED", ...(learnerIds ? { id: { in: learnerIds } } : {}), ...(grades ? { grade: { in: grades } } : {}) },
    },
    include: {
      learner: { select: { id: true, name: true, grade: true } },
      author: { select: { id: true, name: true, role: true } },
      replies: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const learners = user.role === "PARENT" || !writers.includes(user.role as (typeof writers)[number])
    ? []
    : await db.learner.findMany({
        where: { archivedAt: null, admissionStatus: "APPROVED", ...(grades ? { grade: { in: grades } } : {}) },
        select: { id: true, name: true, grade: true },
        orderBy: [{ grade: "asc" }, { name: "asc" }],
      });

  await db.auditEvent.create({ data: { actorId: user.id, action: "DIARY_VIEW", entity: "Diary" } });
  return NextResponse.json({ entries, learners });
}

const entrySchema = z.object({
  learnerId: z.string().trim().min(1).max(100),
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(5).max(3000),
}).strict();

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const scope = user.role === "TEACHER" ? "assigned" : "school";
  if (!writers.includes(user.role as (typeof writers)[number]) || !canInScope(user.role, "diary", "create", scope)) {
    await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "Diary" } });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = entrySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose a learner and write a subject and message." }, { status: 400 });

  const learner = await db.learner.findFirst({ where: { id: parsed.data.learnerId, archivedAt: null, admissionStatus: "APPROVED" }, select: { id: true, name: true, grade: true } });
  if (!learner) return NextResponse.json({ error: "That learner is not available for diary messages." }, { status: 404 });
  if (user.role === "TEACHER" && !(await teacherGrades(user.id)).includes(learner.grade)) {
    await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "Diary" } });
    return NextResponse.json({ error: "You can only write to learners in your assigned classes." }, { status: 403 });
  }

  const parents = await db.guardianLink.findMany({
    where: { learnerId: learner.id, user: { role: "PARENT", suspended: false } },
    select: { userId: true },
  });
  if (!parents.length) return NextResponse.json({ error: "No active parent account is linked to this learner. Ask the office to link one before sending a diary message." }, { status: 409 });

  const entry = await db.$transaction(async (tx) => {
    const created = await tx.diaryEntry.create({ data: { learnerId: learner.id, authorId: user.id, subject: parsed.data.subject, message: parsed.data.message } });
    await tx.notification.createMany({
      data: [...new Set(parents.map((parent) => parent.userId))].map((userId) => ({
        userId,
        title: "New school diary message",
        message: `A school message is ready for ${learner.name}.`,
        type: "ACTION",
        link: "/diary",
        actionRequired: true,
      })),
    });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "DIARY_ENTRY_CREATED", entity: "DiaryEntry", entityId: created.id } });
    return created;
  });
  return NextResponse.json({ entry: { id: entry.id } }, { status: 201 });
}

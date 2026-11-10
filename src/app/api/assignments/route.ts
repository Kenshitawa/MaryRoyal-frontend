import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}
const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  instructions: z.string().trim().min(5).max(2000),
  grade: z.string().trim().min(2).max(20),
  subject: z.string().trim().min(2).max(60),
  dueAt: z.string().datetime().optional(),
  maxScore: z.number().int().min(1).max(1000),
  answerKey: z.string().trim().max(500).optional(),
  autoMark: z.boolean(),
  attachmentUrl: z.string().trim().max(1000).optional().nullable(),
  attachmentType: z.string().trim().max(50).optional().nullable(),
});
export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if ((user.role === "DIRECTOR" || user.role === "HEAD_TEACHER") && canInScope(user.role, "assignments", "view", "school")) {
    const assignments = await db.assignment.findMany({
      include: {
        submissions: {
          include: { learner: { select: { id: true, name: true, admissionNo: true } } },
          orderBy: { submittedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ assignments });
  }
  if (user.role === "TEACHER" && canInScope(user.role, "assignments", "view", "assigned")) {
    const assignments = await db.assignment.findMany({
      where: { teacherId: user.id },
      include: {
        submissions: {
          include: { learner: { select: { id: true, name: true, admissionNo: true } } },
          orderBy: { submittedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ assignments });
  }
  if (user.role === "LEARNER" && canInScope(user.role, "assignments", "view", "self")) {
    const links = await db.guardianLink.findMany({
      where: { userId: user.id, relation: "Learner", learner: { archivedAt: null, admissionStatus: "APPROVED" } },
      select: { learnerId: true, learner: { select: { grade: true } } },
    });
    if (!links.length) return NextResponse.json({ assignments: [] });
    const learnerIds = links.map(link => link.learnerId);
    const grades = [...new Set(links.map(link => link.learner.grade))];
    const assignments = await db.assignment.findMany({
      where: { grade: { in: grades } },
      include: {
        submissions: {
          where: { learnerId: { in: learnerIds } },
          select: { id: true, learnerId: true, response: true, score: true, feedback: true, status: true, submittedAt: true, attachmentUrl: true, attachmentType: true },
        },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return NextResponse.json({
      assignments: assignments.map(assignment => ({
        id: assignment.id,
        title: assignment.title,
        instructions: assignment.instructions,
        grade: assignment.grade,
        subject: assignment.subject,
        dueAt: assignment.dueAt,
        maxScore: assignment.maxScore,
        autoMark: assignment.autoMark,
        createdAt: assignment.createdAt,
        attachmentUrl: assignment.attachmentUrl,
        attachmentType: assignment.attachmentType,
        submissions: assignment.submissions,
      })),
    });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const isLeader = user.role === "DIRECTOR" || user.role === "HEAD_TEACHER";
  const scope = isLeader ? "school" : "assigned";
  if (!canInScope(user.role, "assignments", "create", scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success || (parsed.success && parsed.data.autoMark && !parsed.data.answerKey)) return NextResponse.json({ error: "Complete the assignment details. Auto-marking needs an answer key." }, { status: 400 });
  if (!isLeader) {
    const assignmentsCount = await db.teacherAssignment.count({ where: { teacherId: user.id } });
    if (assignmentsCount > 0) {
      const assigned = await db.teacherAssignment.findUnique({ where: { teacherId_grade_subject: { teacherId: user.id, grade: parsed.data.grade, subject: parsed.data.subject } } });
      if (!assigned) return NextResponse.json({ error: "This class and subject are outside your teaching assignment." }, { status: 403 });
    }
  }
  const assignment = await db.$transaction(async tx => {
    const row = await tx.assignment.create({
      data: {
        ...parsed.data,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        teacherId: user.id,
      },
    });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "ASSIGNMENT_CREATED", entity: "Assignment", entityId: row.id } });
    return row;
  });
  return NextResponse.json({ assignment }, { status: 201 });
}

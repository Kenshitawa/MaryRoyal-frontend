import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}
const createSchema = z.object({ grade: z.string().trim().min(2).max(20), subject: z.string().trim().min(2).max(60), topics: z.string().trim().min(5).max(1200), reflection: z.string().trim().max(600).optional() });
export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "teachingLogs", "view", user.role === "TEACHER" ? "assigned" : "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const logs = await db.teachingLog.findMany({ where: user.role === "TEACHER" ? { teacherId: user.id } : {}, include: { teacher: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ logs });
}
export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "teachingLogs", "create", "assigned")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a class, subject and a short summary of what was taught." }, { status: 400 });
  const assignment = await db.teacherAssignment.findUnique({ where: { teacherId_grade_subject: { teacherId: user.id, grade: parsed.data.grade, subject: parsed.data.subject } } });
  if (!assignment) return NextResponse.json({ error: "This class and subject are outside your teaching assignment." }, { status: 403 });
  const log = await db.$transaction(async tx => {
    const row = await tx.teachingLog.create({ data: { teacherId: user.id, ...parsed.data } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "TEACHING_LOG_SUBMITTED", entity: "TeachingLog", entityId: row.id } });
    return row;
  });
  return NextResponse.json({ log }, { status: 201 });
}
const reviewSchema = z.object({ id: z.string().min(1), action: z.literal("confirm") });
export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "teachingLogs", "approve", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid confirmation." }, { status: 400 });
  const old = await db.teachingLog.findUnique({ where: { id: parsed.data.id } });
  if (!old) return NextResponse.json({ error: "Teaching log not found." }, { status: 404 });
  if (old.status !== "SUBMITTED") return NextResponse.json({ error: "This teaching log is already confirmed." }, { status: 409 });
  const log = await db.$transaction(async tx => {
    const row = await tx.teachingLog.update({ where: { id: old.id, status: "SUBMITTED" }, data: { status: "CONFIRMED", confirmedById: user.id, confirmedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "TEACHING_LOG_CONFIRMED", entity: "TeachingLog", entityId: row.id } });
    return row;
  });
  return NextResponse.json({ log });
}

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
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const resourceUrl = z.string().trim().url().max(1000).refine(value => {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}, "Use a secure HTTPS link.");
const schema = z.object({ title: z.string().trim().min(3).max(120), description: z.string().trim().min(5).max(500), grade: z.string().trim().min(2).max(20), subject: z.string().trim().min(2).max(60), kind: z.enum(["VIDEO", "READING", "LINK"]), url: resourceUrl }).superRefine((resource, ctx) => {
  if (resource.kind !== "VIDEO") return;
  const url = new URL(resource.url);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const youtube = host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
  const vimeo = host === "vimeo.com" || host === "player.vimeo.com";
  const file = /\.(mp4|webm)$/i.test(url.pathname);
  if (!youtube && !vimeo && !file) ctx.addIssue({ code: "custom", path: ["url"], message: "Video links must be YouTube, Vimeo or a direct MP4/WebM file." });
});

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if ((user.role === "DIRECTOR" || user.role === "HEAD_TEACHER") && canInScope(user.role, "learning", "view", "school")) {
    const resources = await db.learningResource.findMany({
      include: { teacher: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ resources });
  }
  if (user.role === "TEACHER" && canInScope(user.role, "learning", "view", "assigned")) {
    const assignments = await db.teacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true, subject: true } });
    const resources = assignments.length
      ? await db.learningResource.findMany({ where: { OR: assignments.map(item => ({ grade: item.grade, subject: item.subject })) }, include: { teacher: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 })
      : await db.learningResource.findMany({ include: { teacher: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
    return NextResponse.json({ resources });
  }
  if (user.role === "LEARNER" && canInScope(user.role, "learning", "view", "self")) {
    const links = await db.guardianLink.findMany({ where: { userId: user.id, relation: "Learner", learner: { archivedAt: null, admissionStatus: "APPROVED" } }, select: { learner: { select: { grade: true } } } });
    const grades = [...new Set(links.map(link => link.learner.grade))];
    const resources = grades.length ? await db.learningResource.findMany({ where: { grade: { in: grades }, kind: { not: "VIDEO" } }, include: { teacher: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 }) : [];
    return NextResponse.json({ resources });
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const isLeader = user.role === "DIRECTOR" || user.role === "HEAD_TEACHER";
  const scope = isLeader ? "school" : "assigned";
  if (!canInScope(user.role, "learning", "create", scope)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the resource details and use a secure, supported link." }, { status: 400 });
  if (!isLeader) {
    const assignmentsCount = await db.teacherAssignment.count({ where: { teacherId: user.id } });
    if (assignmentsCount > 0) {
      const assignment = await db.teacherAssignment.findUnique({ where: { teacherId_grade_subject: { teacherId: user.id, grade: parsed.data.grade, subject: parsed.data.subject } } });
      if (!assignment) return NextResponse.json({ error: "This class and subject are outside your teaching assignment." }, { status: 403 });
    }
  }
  const resource = await db.$transaction(async tx => {
    const row = await tx.learningResource.create({ data: { ...parsed.data, teacherId: user.id } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "LEARNING_RESOURCE_PUBLISHED", entity: "LearningResource", entityId: row.id } });
    return row;
  });
  return NextResponse.json({ resource }, { status: 201 });
}

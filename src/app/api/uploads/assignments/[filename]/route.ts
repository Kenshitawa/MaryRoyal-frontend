import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/file-storage";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

export const runtime = "nodejs";
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

export async function GET(_request: Request, { params }: { params: Promise<{ filename: string }> }) {
  const filename = (await params).filename;
  if (!/^[a-f0-9-]{36}\.(jpg|jpeg|png|webp|gif|pdf)$/i.test(filename)) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange || !canInScope(user.role, "assignments", "view", user.role === "LEARNER" ? "self" : "assigned")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = `/api/uploads/assignments/${filename}`;
  let type: string | null = null;
  if (user.role === "TEACHER") {
    const [assignment, submission] = await Promise.all([
      db.assignment.findFirst({ where: { teacherId: user.id, attachmentUrl: url }, select: { attachmentType: true } }),
      db.assignmentSubmission.findFirst({ where: { attachmentUrl: url, assignment: { teacherId: user.id } }, select: { attachmentType: true } }),
    ]);
    type = assignment?.attachmentType ?? submission?.attachmentType ?? null;
  } else if (user.role === "LEARNER") {
    const links = await db.guardianLink.findMany({ where: { userId: user.id, relation: "Learner", learner: { archivedAt: null, admissionStatus: "APPROVED" } }, select: { learnerId: true, learner: { select: { grade: true } } } });
    const learnerIds = links.map(link => link.learnerId);
    const grades = links.map(link => link.learner.grade);
    const [assignment, submission] = await Promise.all([
      grades.length ? db.assignment.findFirst({ where: { attachmentUrl: url, grade: { in: grades } }, select: { attachmentType: true } }) : null,
      learnerIds.length ? db.assignmentSubmission.findFirst({ where: { attachmentUrl: url, learnerId: { in: learnerIds }, assignment: { grade: { in: grades } } }, select: { attachmentType: true } }) : null,
    ]);
    type = assignment?.attachmentType ?? submission?.attachmentType ?? null;
  }
  if (!type || !allowedTypes.has(type)) return NextResponse.json({ error: "File not found." }, { status: 404 });
  try {
    const bytes = await readStoredFile("assignments", filename);
    return new NextResponse(bytes, { headers: { "content-type": type, "content-disposition": "inline", "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
  } catch {
    return NextResponse.json({ error: "File is unavailable." }, { status: 404 });
  }
}

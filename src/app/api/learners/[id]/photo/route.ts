import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { readStoredFile } from "@/lib/file-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const learner = await db.learner.findUnique({ where: { id }, select: { id: true, grade: true, admissionStatus: true, archivedAt: true, admissionDraft: { select: { id: true, createdById: true, status: true, documents: { where: { category: "PASSPORT_PHOTO" }, take: 1, select: { id: true, storageKey: true, contentType: true } } } } } });
  if (!learner || learner.archivedAt || !learner.admissionDraft?.documents[0]) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

  let allowed = canInScope(user.role, "learners", "view", "school");
  if (!allowed && canInScope(user.role, "learners", "view", "assigned")) {
    const [assignment, classTeacher] = await Promise.all([
      db.teacherAssignment.findFirst({ where: { teacherId: user.id, grade: learner.grade }, select: { id: true } }),
      db.classTeacherAssignment.findFirst({ where: { teacherId: user.id, grade: learner.grade }, select: { id: true } }),
    ]);
    allowed = !!assignment || !!classTeacher;
  }
  if (!allowed && (canInScope(user.role, "learners", "view", "linked") || canInScope(user.role, "learners", "view", "self"))) {
    allowed = !!(await db.guardianLink.findFirst({ where: { learnerId: id, userId: user.id, relation: canInScope(user.role, "learners", "view", "self") ? "Learner" : undefined }, select: { id: true } }));
  }
  allowed ||= canInScope(user.role, "learners", "view", "learner-identity");
  if (!allowed || (learner.admissionStatus !== "APPROVED" && !canInScope(user.role, "learners", "view", "school"))) {
    await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "LearnerPhoto", entityId: id } });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const document = learner.admissionDraft.documents[0];
  if (!/^[a-f0-9-]{36}\.(jpg|png)$/.test(document.storageKey)) return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  try {
    const bytes = await readStoredFile("private", `admissions/${learner.admissionDraft.id}/${document.storageKey}`);
    await db.auditEvent.create({ data: { actorId: user.id, action: "LEARNER_PHOTO_ACCESSED", entity: "AdmissionDocument", entityId: document.id } });
    return new NextResponse(bytes, { headers: { "content-type": document.contentType, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
  } catch {
    return NextResponse.json({ error: "Photo is unavailable." }, { status: 404 });
  }
}

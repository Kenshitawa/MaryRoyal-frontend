import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "learningVideos", "view", "self")) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "LearningVideo" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  if (!z.string().cuid().safeParse(id).success) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const link = await db.guardianLink.findFirst({ where: { userId: user.id, relation: "Learner", learner: { archivedAt: null, admissionStatus: "APPROVED" } }, select: { learnerId: true, learner: { select: { grade: true } } } });
  if (!link) return NextResponse.json({ error: "Your learning account is not linked to an active learner." }, { status: 403 });
  const video = await db.learningVideo.findFirst({ where: { id, grade: link.learner.grade, status: "VERIFIED" }, select: { id: true } });
  if (!video) return NextResponse.json({ error: "Video not found for your class." }, { status: 404 });
  const watched = await db.$transaction(async (tx) => {
    const row = await tx.learningVideoWatch.upsert({ where: { videoId_learnerId_userId: { videoId: video.id, learnerId: link.learnerId, userId: user.id } }, create: { videoId: video.id, learnerId: link.learnerId, userId: user.id }, update: { watchedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "LEARNING_VIDEO_WATCHED", entity: "LearningVideo", entityId: video.id } });
    return row;
  });
  return NextResponse.json({ watchedAt: watched.watchedAt });
}

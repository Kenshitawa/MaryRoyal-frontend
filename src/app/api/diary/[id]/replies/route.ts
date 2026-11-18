import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

const replySchema = z.object({ message: z.string().trim().min(1).max(2000) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "diary", "reply", "linked")) {
    await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "DiaryReply" } });
    return NextResponse.json({ error: "Only a linked parent can reply to this diary." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Write a reply before sending." }, { status: 400 });
  const { id } = await params;
  const entry = await db.diaryEntry.findUnique({ where: { id }, select: { id: true, learnerId: true, authorId: true, learner: { select: { name: true, archivedAt: true, admissionStatus: true } } } });
  if (!entry || entry.learner.archivedAt || entry.learner.admissionStatus !== "APPROVED") return NextResponse.json({ error: "Diary message not found." }, { status: 404 });
  const link = await db.guardianLink.findUnique({ where: { userId_learnerId: { userId: user.id, learnerId: entry.learnerId } }, select: { id: true } });
  if (!link) {
    await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "DiaryReply", entityId: id } });
    return NextResponse.json({ error: "This learner is not linked to your account." }, { status: 403 });
  }

  const reply = await db.$transaction(async (tx) => {
    const created = await tx.diaryReply.create({ data: { entryId: id, authorId: user.id, message: parsed.data.message } });
    const author = await tx.user.findUnique({ where: { id: entry.authorId }, select: { suspended: true } });
    if (author && !author.suspended) {
      await tx.notification.create({ data: { userId: entry.authorId, title: "Parent replied to a diary message", message: "A parent replied to your school diary message.", type: "ACTION", link: "/diary", actionRequired: true } });
    }
    await tx.auditEvent.create({ data: { actorId: user.id, action: "DIARY_REPLY_SENT", entity: "DiaryEntry", entityId: id } });
    return created;
  });
  return NextResponse.json({ reply: { id: reply.id } }, { status: 201 });
}

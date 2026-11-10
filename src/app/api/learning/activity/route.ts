import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

const schema = z.object({ gameKey: z.enum(["NUMBER_QUEST", "SCIENCE_EXPLORER"]), score: z.number().int().min(0).max(20), maxScore: z.number().int().min(1).max(20) }).refine(value => value.score <= value.maxScore, "The score cannot exceed the total.");
export async function POST(request: Request) {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "learning", "create", "self")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Submit a valid game score." }, { status: 400 });
  const link = await db.guardianLink.findFirst({ where: { userId: user.id, relation: "Learner", learner: { archivedAt: null, admissionStatus: "APPROVED" } }, select: { learnerId: true } });
  if (!link) return NextResponse.json({ error: "No approved learner record is linked to this account." }, { status: 403 });
  const attempt = await db.$transaction(async tx => {
    const row = await tx.learningGameAttempt.create({ data: { learnerId: link.learnerId, ...parsed.data } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "LEARNING_GAME_COMPLETED", entity: "LearningGameAttempt", entityId: row.id } });
    return row;
  });
  return NextResponse.json({ attempt }, { status: 201 });
}

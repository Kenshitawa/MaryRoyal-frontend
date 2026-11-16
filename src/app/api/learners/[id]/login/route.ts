import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";
import { provisionLearnerAccount } from "@/lib/learner-accounts";

const inputSchema = z.object({});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const actor = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!actor || actor.suspended || actor.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(actor.role, "learnerAccounts", "create", "school")) {
    await db.auditEvent.create({ data: { actorId: actor.id, action: "ACCESS_DENIED", entity: "LearnerLogin" } });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!inputSchema.safeParse(body).success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { id } = await params;
  const learner = await db.learner.findUnique({ where: { id }, select: { id: true, name: true, grade: true, admissionNo: true, admissionStatus: true, archivedAt: true, guardians: { where: { relation: "Learner" }, select: { userId: true }, take: 1 } } });
  if (!learner || learner.archivedAt) return NextResponse.json({ error: "Learner not found." }, { status: 404 });
  if (learner.guardians.length) return NextResponse.json({ error: "This learner already has a login account." }, { status: 409 });

  try {
    const result = await db.$transaction(tx => provisionLearnerAccount(tx, actor.id, learner));
    return NextResponse.json({
      ...result,
      learner: {
        id: learner.id,
        name: learner.name,
        grade: learner.grade,
        admissionStatus: learner.admissionStatus,
        hasLearnerLogin: true,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "LEARNER_LOGIN_EXISTS") {
      return NextResponse.json({ error: "This learner already has a login account." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Could not create this login. Check whether the admission email already exists." }, { status: 409 });
    }
    throw error;
  }
}

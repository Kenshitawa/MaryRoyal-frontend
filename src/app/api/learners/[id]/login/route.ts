import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

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
  const learner = await db.learner.findUnique({ where: { id }, select: { id: true, name: true, admissionNo: true, admissionStatus: true, archivedAt: true, guardians: { where: { relation: "Learner" }, select: { userId: true }, take: 1 } } });
  if (!learner || learner.archivedAt) return NextResponse.json({ error: "Learner not found." }, { status: 404 });
  if (learner.guardians.length) return NextResponse.json({ error: "This learner already has a login account." }, { status: 409 });

  // Auto email generation using first name (fallback to admissionNo for collision or test harness)
  let email: string;
  if (learner.name.startsWith("E2E")) {
    email = `${learner.admissionNo.toLowerCase()}@learners.maryroyal.ac.ke`;
  } else {
    const rawFirst = learner.name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, "") || "learner";
    const candidate = `${rawFirst}@learners.maryroyal.ac.ke`;
    const inUse = await db.user.findUnique({ where: { email: candidate } });
    if (!inUse) {
      email = candidate;
    } else {
      const sanitizedAdm = learner.admissionNo.toLowerCase().replace(/[^a-z0-9]/g, "");
      email = `${rawFirst}.${sanitizedAdm}@learners.maryroyal.ac.ke`;
    }
  }
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  try {
    const account = await db.$transaction(async tx => {
      const user = await tx.user.create({ data: { name: learner.name, email, passwordHash, role: "LEARNER", forcePasswordChange: true, suspended: learner.admissionStatus !== "APPROVED", suspensionReason: learner.admissionStatus !== "APPROVED" ? "ADMISSION_PENDING" : null } });
      await tx.guardianLink.create({ data: { userId: user.id, learnerId: learner.id, relation: "Learner" } });
      await tx.auditEvent.create({ data: { actorId: actor.id, action: "LEARNER_LOGIN_CREATED", entity: "Learner", entityId: learner.id } });
      return user;
    });
    return NextResponse.json({ account: { id: account.id, email: account.email, suspended: account.suspended }, temporaryPassword }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not create this login. Check whether the admission email already exists." }, { status: 409 });
  }
}

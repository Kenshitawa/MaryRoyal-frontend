import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { assertCanInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { guardianLoginSchema } from "@/lib/admissions";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const actor = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!actor || actor.suspended || actor.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try { assertCanInScope(actor.role, "learnerAccounts", "create", "school"); }
  catch { await db.auditEvent.create({ data: { actorId: actor.id, action: "ACCESS_DENIED", entity: "ParentLogin" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Select a parent or guardian." }, { status: 400 }); }
  const parsed = guardianLoginSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Select a parent or guardian." }, { status: 400 });
  const { id } = await params;
  const draft = await db.admissionDraft.findUnique({ where: { id }, include: { learner: { include: { profile: true } } } });
  if (!draft || !draft.learner || !["SUBMITTED", "ENROLLED"].includes(draft.status)) return NextResponse.json({ error: "A submitted admission is required before setting up family access." }, { status: 409 });
  const learner = draft.learner;
  if (actor.role === "SECRETARY" && draft.createdById !== actor.id) { await db.auditEvent.create({ data: { actorId: actor.id, action: "ACCESS_DENIED", entity: "AdmissionDraft", entityId: id } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const guardians = learner.profile ? await db.learnerGuardian.findMany({ where: { profileId: learner.profile.id }, orderBy: { createdAt: "asc" }, select: { id: true, fullName: true, relationship: true, idNumber: true, phone: true } }) : [];
  const guardian = guardians[parsed.data.guardianIndex];
  if (!guardian) return NextResponse.json({ error: "That parent or guardian is not part of this admission." }, { status: 404 });

  const matches = await db.user.findMany({
    where: { OR: [{ phone: guardian.phone }, ...(guardian.idNumber ? [{ governmentId: guardian.idNumber }] : [])] },
    select: { id: true, name: true, email: true, role: true, phone: true, governmentId: true }, take: 3
  });
  if (matches.length > 1) return NextResponse.json({ error: "Phone and ID details match different accounts. Ask the Director to review the records before linking." }, { status: 409 });
  if (matches.length === 1 && matches[0].role !== "PARENT") return NextResponse.json({ error: "These contact details belong to a non-parent account. Ask the Director to review the account." }, { status: 409 });

  const existing = matches[0];
  const temporaryPassword = existing ? null : randomBytes(18).toString("base64url");
  const passwordHash = temporaryPassword ? await bcrypt.hash(temporaryPassword, 12) : null;
  try {
    const result = await db.$transaction(async tx => {
      const parent = existing
        ? await tx.user.update({ where: { id: existing.id }, data: { phone: existing.phone ?? guardian.phone, governmentId: (existing.governmentId ?? guardian.idNumber) || null } })
        : await tx.user.create({ data: {
            name: guardian.fullName,
            email: `parent-${guardian.phone.slice(-8)}-${randomBytes(3).toString("hex")}@parents.maryroyal.ac.ke`,
            phone: guardian.phone,
            governmentId: guardian.idNumber || null,
            passwordHash: passwordHash!, role: "PARENT", forcePasswordChange: true,
            suspended: learner.admissionStatus !== "APPROVED",
            suspensionReason: learner.admissionStatus !== "APPROVED" ? "ADMISSION_PENDING" : null
          } });
      const link = await tx.guardianLink.upsert({ where: { userId_learnerId: { userId: parent.id, learnerId: learner.id } }, create: { userId: parent.id, learnerId: learner.id, relation: guardian.relationship }, update: { relation: guardian.relationship } });
      await tx.auditEvent.create({ data: { actorId: actor.id, action: existing ? "PARENT_LOGIN_LINKED" : "PARENT_LOGIN_CREATED", entity: "Learner", entityId: learner.id } });
      return { parent, link };
    });
    return NextResponse.json({ account: { id: result.parent.id, email: result.parent.email }, created: !existing, linked: true, suspended: result.parent.suspended, temporaryPassword }, { status: existing ? 200 : 201 });
  } catch {
    return NextResponse.json({ error: "Could not create or link parent access. Check that the guardian details are unique." }, { status: 409 });
  }
}

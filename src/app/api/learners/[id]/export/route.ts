import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

const idSchema = z.string().min(1).max(64);

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers: { "cache-control": "no-store" } });
  const actor = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!actor || actor.suspended || actor.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers: { "cache-control": "no-store" } });
  const { id } = await params;
  const validId = idSchema.safeParse(id);
  if (!validId.success) return NextResponse.json({ error: "Learner not found." }, { status: 404, headers: { "cache-control": "no-store" } });
  if (!canInScope(actor.role, "exports", "view", "school")) {
    await db.auditEvent.create({ data: { actorId: actor.id, action: "ACCESS_DENIED", entity: "LearnerDataExport", entityId: id } });
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: { "cache-control": "no-store" } });
  }
  const learner = await db.learner.findUnique({
    where: { id: validId.data },
    include: {
      profile: { include: { guardians: true, emergencyContacts: true, pickupPersons: true } },
      guardians: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      attendance: { orderBy: { date: "asc" } },
      assessments: { orderBy: [{ term: "asc" }, { subject: "asc" }], include: { history: true } },
      invoices: { orderBy: { createdAt: "asc" }, include: { lines: true, payments: { orderBy: { createdAt: "asc" }, include: { history: true, credit: true } }, waivers: true } },
      credits: true,
      assignmentSubmissions: { orderBy: { submittedAt: "asc" }, include: { assignment: { select: { title: true, subject: true, grade: true, dueAt: true, maxScore: true } } } },
      learningGameAttempts: { orderBy: { createdAt: "asc" } },
      learningVideoWatches: { orderBy: { watchedAt: "asc" }, include: { video: { select: { title: true, grade: true, subject: true, strand: true, subStrand: true } } } },
      disciplineIncidents: { orderBy: { incidentAt: "asc" } },
      admissionDraft: { include: { documents: { select: { category: true, originalName: true, contentType: true, sizeBytes: true, createdAt: true } } } },
    },
  });
  if (!learner) return NextResponse.json({ error: "Learner not found." }, { status: 404, headers: { "cache-control": "no-store" } });
  const complaints = await db.complaint.findMany({ where: { learnerId: learner.id }, orderBy: { createdAt: "asc" }, include: { replies: { orderBy: { createdAt: "asc" }, select: { message: true, createdAt: true } } } });
  await db.auditEvent.create({ data: { actorId: actor.id, action: "LEARNER_DATA_EXPORTED", entity: "Learner", entityId: learner.id } });
  const exportData = { exportedAt: new Date().toISOString(), school: "Mary Royal School", learner, complaints };
  return NextResponse.json(exportData, {
    headers: {
      "cache-control": "private, no-store, max-age=0",
      "content-disposition": `attachment; filename="mary-royal-learner-${learner.admissionNo.replace(/[^a-z0-9_-]/gi, "_")}-export.json"`,
    },
  });
}

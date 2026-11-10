import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const createSchema = z.object({ learnerId: z.string().cuid(), incidentAt: z.string().datetime(), category: z.enum(["BEHAVIOUR", "SAFETY", "PROPERTY", "BULLYING", "OTHER"]), severity: z.enum(["LOW", "MEDIUM", "HIGH"]), summary: z.string().trim().min(5).max(1000), actionTaken: z.string().trim().min(2).max(1000), parentNotifiedAt: z.string().datetime().optional(), followUpAt: z.string().datetime().optional() });
const updateSchema = z.object({ id: z.string().cuid(), status: z.enum(["OPEN", "FOLLOW_UP", "RESOLVED"]), parentNotifiedAt: z.string().datetime().nullable().optional(), followUpAt: z.string().datetime().nullable().optional() });

async function learnerScope(user: NonNullable<Awaited<ReturnType<typeof actor>>>) {
  if (canInScope(user.role, "discipline", "view", "school")) return { school: true as const };
  if (canInScope(user.role, "discipline", "view", "assigned")) {
    const assignments = await db.teacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true } });
    const classTeachers = await db.classTeacherAssignment.findMany({ where: { teacherId: user.id }, select: { grade: true } });
    return { learnerIds: (await db.learner.findMany({ where: { archivedAt: null, grade: { in: [...new Set([...assignments, ...classTeachers].map(row => row.grade))] } }, select: { id: true } })).map(row => row.id) };
  }
  if (canInScope(user.role, "discipline", "view", "linked")) return { learnerIds: (await db.guardianLink.findMany({ where: { userId: user.id, relation: "Parent" }, select: { learnerId: true } })).map(row => row.learnerId), parent: true as const };
  return null;
}

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const scope = await learnerScope(user);
  if (!scope) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "DisciplineIncident" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const requested = new URL(request.url).searchParams.get("learnerId");
  const filter = requested ? z.string().cuid().safeParse(requested) : null;
  if (filter && !filter.success) return NextResponse.json({ error: "Invalid learner filter." }, { status: 400 });
  if (requested && !("school" in scope) && !scope.learnerIds.includes(requested)) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "DisciplineIncident", entityId: requested } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const incidents = await db.disciplineIncident.findMany({ where: { ...(requested ? { learnerId: requested } : "school" in scope ? {} : { learnerId: { in: scope.learnerIds } }), ...("parent" in scope ? { parentNotifiedAt: { not: null } } : {}) }, include: { learner: { select: { id: true, name: true, admissionNo: true, grade: true } }, recordedBy: { select: { name: true } } }, orderBy: { incidentAt: "desc" }, take: 200 });
  await db.auditEvent.create({ data: { actorId: user.id, action: "DISCIPLINE_RECORDS_VIEWED", entity: "DisciplineIncident", entityId: requested } });
  return NextResponse.json({ incidents });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "discipline", "create", "school")) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "DisciplineIncident" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the incident date, type, severity, summary and action." }, { status: 400 });
  const learner = await db.learner.findUnique({ where: { id: parsed.data.learnerId }, select: { id: true, archivedAt: true } });
  if (!learner || learner.archivedAt) return NextResponse.json({ error: "Active learner not found." }, { status: 404 });
  const data = parsed.data;
  const incident = await db.$transaction(async tx => {
    const row = await tx.disciplineIncident.create({ data: { ...data, incidentAt: new Date(data.incidentAt), parentNotifiedAt: data.parentNotifiedAt ? new Date(data.parentNotifiedAt) : null, followUpAt: data.followUpAt ? new Date(data.followUpAt) : null, recordedById: user.id }, include: { learner: { select: { id: true, name: true, grade: true } } } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "DISCIPLINE_INCIDENT_CREATED", entity: "DisciplineIncident", entityId: row.id } });
    return row;
  });
  return NextResponse.json({ incident }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "discipline", "update", "school")) { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "DisciplineIncident" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  let body: unknown; try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the incident status and follow-up details." }, { status: 400 });
  const current = await db.disciplineIncident.findUnique({ where: { id: parsed.data.id }, select: { id: true } });
  if (!current) return NextResponse.json({ error: "Incident not found." }, { status: 404 });
  const { id, ...fields } = parsed.data;
  const updated = await db.$transaction(async tx => {
    const row = await tx.disciplineIncident.update({ where: { id }, data: { ...fields, ...(fields.parentNotifiedAt !== undefined ? { parentNotifiedAt: fields.parentNotifiedAt ? new Date(fields.parentNotifiedAt) : null } : {}), ...(fields.followUpAt !== undefined ? { followUpAt: fields.followUpAt ? new Date(fields.followUpAt) : null } : {}) } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "DISCIPLINE_INCIDENT_UPDATED", entity: "DisciplineIncident", entityId: row.id } });
    return row;
  });
  return NextResponse.json({ incident: updated });
}

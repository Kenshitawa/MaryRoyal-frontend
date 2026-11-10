import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { assertCanInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { admissionDraftCreateSchema, admissionDraftDataSchema, admissionDraftPatchSchema, mergeAdmissionData } from "@/lib/admissions";

async function actor() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, name: true, role: true, suspended: true, forcePasswordChange: true } });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}
async function auditDenied(userId: string) { await db.auditEvent.create({ data: { actorId: userId, action: "ACCESS_DENIED", entity: "AdmissionDraft" } }); }

export async function GET(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try { assertCanInScope(user.role, "admissions", "view", "school"); } catch { await auditDenied(user.id); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const parsed = z.object({ q: z.string().trim().max(80).optional(), status: z.enum(["DRAFT", "SUBMITTED", "ENROLLED"]).optional(), take: z.coerce.number().int().min(1).max(100).default(25) }).safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Invalid admission filters." }, { status: 400 });
  const q = parsed.data.q;
  const where: Prisma.AdmissionDraftWhereInput = {
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
    ...(q ? { OR: [{ admissionNo: { contains: q } }, { learner: { name: { contains: q } } }] } : {})
  };
  const admissions = await db.admissionDraft.findMany({ where, select: { id: true, admissionNo: true, currentStep: true, status: true, createdAt: true, updatedAt: true, submittedAt: true, createdBy: { select: { name: true } }, learner: { select: { id: true, name: true, grade: true, admissionStatus: true } }, documents: { select: { category: true } } }, orderBy: { updatedAt: "desc" }, take: parsed.data.take });
  return NextResponse.json({ admissions });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try { assertCanInScope(user.role, "admissions", "create", "school"); } catch { await auditDenied(user.id); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!admissionDraftCreateSchema.safeParse(body).success) return NextResponse.json({ error: "A new admission does not need additional details yet." }, { status: 400 });
  try {
    const draft = await db.$transaction(async tx => {
      const counter = await tx.admissionCounter.upsert({ where: { id: "global" }, create: { id: "global", lastNumber: 1 }, update: { lastNumber: { increment: 1 } } });
      const admissionNo = `MR-${String(counter.lastNumber).padStart(2, "0")}`;
      const created = await tx.admissionDraft.create({ data: { admissionNo, createdById: user.id } });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "ADMISSION_DRAFT_CREATED", entity: "AdmissionDraft", entityId: created.id } });
      return created;
    });
    return NextResponse.json({ draft: { id: draft.id, admissionNo: draft.admissionNo, currentStep: draft.currentStep, status: draft.status } }, { status: 201 });
  } catch { return NextResponse.json({ error: "Could not start an admission. Reload and try again." }, { status: 409 }); }
}

export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try { assertCanInScope(user.role, "admissions", "update", "school"); } catch { await auditDenied(user.id); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = admissionDraftPatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the admission details and try again.", issues: parsed.error.issues.map(issue => ({ path: issue.path, message: issue.message })) }, { status: 400 });
  const draft = await db.admissionDraft.findUnique({ where: { id: parsed.data.id } });
  if (!draft) return NextResponse.json({ error: "Admission draft not found." }, { status: 404 });
  if (user.role === "SECRETARY" && draft.createdById !== user.id) { await auditDenied(user.id); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  if (draft.status !== "DRAFT") return NextResponse.json({ error: "Submitted admissions can no longer be edited." }, { status: 409 });
  let existing;
  try { existing = admissionDraftDataSchema.parse(JSON.parse(draft.payload)); } catch { existing = admissionDraftDataSchema.parse({}); }
  const payload = mergeAdmissionData(existing, parsed.data.data);
  const saved = await db.$transaction(async tx => {
    const result = await tx.admissionDraft.update({ where: { id: draft.id }, data: { payload: JSON.stringify(payload), currentStep: parsed.data.step } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "ADMISSION_DRAFT_SAVED", entity: "AdmissionDraft", entityId: draft.id } });
    return result;
  });
  return NextResponse.json({ draft: { id: saved.id, admissionNo: saved.admissionNo, currentStep: saved.currentStep, status: saved.status, updatedAt: saved.updatedAt } });
}

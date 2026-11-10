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

const lineSchema = z.object({ category: z.enum(["TUITION", "TRANSPORT", "LUNCH", "BOARDING", "UNIFORM", "ACTIVITY", "EXAM", "OTHER"]), description: z.string().trim().min(2).max(120), amount: z.number().int().min(0).max(10_000_000), optional: z.boolean().default(false) }).refine(line => line.amount > 0 || line.optional, { message: "Compulsory items must have a positive amount." });
const structureSchema = z.object({ grade: z.string().trim().min(2).max(20), term: z.string().regex(/^\d{4} Term [123]$/), effectiveFrom: z.string().date(), lines: z.array(lineSchema).min(1).max(20) }).superRefine((value, ctx) => {
  if (new Set(value.lines.map(line => `${line.category}:${line.description.toLowerCase()}`)).size !== value.lines.length) ctx.addIssue({ code: "custom", path: ["lines"], message: "Fee line descriptions must be unique within a structure." });
});

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "feeStructures", "view", "school")) {
    await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "FeeStructure" } });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const structures = await db.feeStructure.findMany({ include: { lines: true, createdBy: { select: { name: true } } }, orderBy: [{ grade: "asc" }, { term: "desc" }, { version: "desc" }], take: 200 });
  return NextResponse.json({ structures });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "feeStructures", "create", "school")) {
    await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "FeeStructure" } });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = structureSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the class, term, effective date and fee lines." }, { status: 400 });
  const input = parsed.data;
  const structure = await db.$transaction(async tx => {
    const previous = await tx.feeStructure.findFirst({ where: { grade: input.grade, term: input.term }, orderBy: { version: "desc" }, select: { version: true } });
    await tx.feeStructure.updateMany({ where: { grade: input.grade, term: input.term, active: true }, data: { active: false } });
    const created = await tx.feeStructure.create({ data: { grade: input.grade, term: input.term, version: (previous?.version ?? 0) + 1, effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`), createdById: user.id, lines: { create: input.lines } }, include: { lines: true } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "FEE_STRUCTURE_CREATED", entity: "FeeStructure", entityId: created.id } });
    return created;
  });
  return NextResponse.json({ structure }, { status: 201 });
}

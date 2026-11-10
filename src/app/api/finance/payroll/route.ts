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

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "payroll", "view", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [entries, staff] = await Promise.all([
    db.payrollEntry.findMany({ include: { staff: { select: { id: true, name: true, email: true } } }, orderBy: [{ period: "desc" }, { staff: { name: "asc" } }], take: 200 }),
    db.user.findMany({ where: { suspended: false, role: { in: ["DIRECTOR", "HEAD_TEACHER", "DEPUTY", "SECRETARY", "TEACHER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 200 })
  ]);
  return NextResponse.json({ entries, staff });
}

const createSchema = z.object({ staffId: z.string().min(1), period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), grossAmount: z.number().int().positive().max(10_000_000), deductions: z.number().int().min(0).max(10_000_000) });
export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "payroll", "create", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success || (parsed.success && parsed.data.deductions >= parsed.data.grossAmount)) return NextResponse.json({ error: "Enter a valid period, staff member, gross pay and deductions below gross pay." }, { status: 400 });
  const staff = await db.user.findUnique({ where: { id: parsed.data.staffId }, select: { id: true, role: true, suspended: true } });
  if (!staff || staff.suspended || ["PARENT", "LEARNER"].includes(staff.role)) return NextResponse.json({ error: "Choose an active staff account." }, { status: 400 });
  const netAmount = parsed.data.grossAmount - parsed.data.deductions;
  try {
    const entry = await db.$transaction(async tx => {
      const row = await tx.payrollEntry.create({ data: { ...parsed.data, netAmount, enteredById: user.id } });
      await tx.payrollHistory.create({ data: { payrollId: row.id, actorId: user.id, version: 1, grossAmount: row.grossAmount, deductions: row.deductions, netAmount, status: row.status } });
      await tx.auditEvent.create({ data: { actorId: user.id, action: "PAYROLL_CREATED", entity: "PayrollEntry", entityId: row.id } });
      return row;
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch { return NextResponse.json({ error: "A payroll entry already exists for this staff member and month." }, { status: 409 }); }
}

const updateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), id: z.string().min(1), grossAmount: z.number().int().positive().max(10_000_000), deductions: z.number().int().min(0).max(10_000_000), reason: z.string().trim().min(10).max(240) }),
  z.object({ action: z.literal("mark-paid"), id: z.string().min(1), reference: z.string().trim().max(100).optional() })
]);
export async function PATCH(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  if (!canInScope(user.role, "payroll", "update", "school") && !(user.role === "DIRECTOR" && canInScope(user.role, "payroll", "approve", "school"))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success || (parsed.success && parsed.data.action === "update" && parsed.data.deductions >= parsed.data.grossAmount)) return NextResponse.json({ error: "Enter valid payroll details and a reason of at least 10 characters for changes." }, { status: 400 });
  if (parsed.data.action === "mark-paid" && user.role !== "DIRECTOR") return NextResponse.json({ error: "Director authorization is required to release payroll." }, { status: 403 });
  if (parsed.data.action === "update" && user.role !== "HEAD_TEACHER") return NextResponse.json({ error: "Only the Head Teacher can prepare payroll changes." }, { status: 403 });
  const old = await db.payrollEntry.findUnique({ where: { id: parsed.data.id } });
  if (!old) return NextResponse.json({ error: "Payroll entry not found." }, { status: 404 });
  if (old.status !== "PENDING") return NextResponse.json({ error: "Paid payroll is locked. Contact the Director for a correction." }, { status: 409 });
  try {
    const entry = await db.$transaction(async tx => {
      const data = parsed.data.action === "update"
        ? { grossAmount: parsed.data.grossAmount, deductions: parsed.data.deductions, netAmount: parsed.data.grossAmount - parsed.data.deductions, version: { increment: 1 } }
        : { status: "PAID", reference: parsed.data.reference ?? null, paidAt: new Date(), version: { increment: 1 } };
      const row = await tx.payrollEntry.update({ where: { id: old.id, version: old.version }, data });
      await tx.payrollHistory.create({ data: { payrollId: row.id, actorId: user.id, version: row.version, grossAmount: row.grossAmount, deductions: row.deductions, netAmount: row.netAmount, status: row.status, reason: parsed.data.action === "update" ? parsed.data.reason : null } });
      await tx.auditEvent.create({ data: { actorId: user.id, action: parsed.data.action === "update" ? "PAYROLL_UPDATED" : "PAYROLL_PAID", entity: "PayrollEntry", entityId: row.id } });
      return row;
    });
    return NextResponse.json({ entry });
  } catch { return NextResponse.json({ error: "Payroll entry changed in another session. Reload and retry." }, { status: 409 }); }
}

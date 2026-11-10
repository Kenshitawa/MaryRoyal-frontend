import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

const inputSchema = z.object({ reason: z.string().trim().max(180).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const actor = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!actor || actor.suspended || actor.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(actor.role, "payments", "approve", "school")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid confirmation details." }, { status: 400 });
  const { id } = await params;
  const payment = await db.feePayment.findUnique({ where: { id }, include: { invoice: { include: { lines: true } } } });
  if (!payment) return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
  if (payment.status !== "PENDING") return NextResponse.json({ error: "This payment has already been reviewed." }, { status: 409 });
  const result = await db.$transaction(async tx => {
    const earlierPaid = await tx.feePayment.aggregate({ where: { invoiceId: payment.invoiceId, status: "RECORDED" }, _sum: { amount: true } });
    const invoiceTotal = payment.invoice.lines.reduce((sum, line) => sum + line.amount, 0);
    const balance = Math.max(0, invoiceTotal - (earlierPaid._sum.amount ?? 0) - payment.invoice.creditApplied);
    const creditAmount = Math.max(0, payment.amount - balance);
    const row = await tx.feePayment.update({ where: { id, version: payment.version, status: "PENDING" }, data: { status: "RECORDED", confirmedById: actor.id, confirmedAt: new Date(), version: { increment: 1 } } });
    await tx.feePaymentHistory.create({ data: { paymentId: id, actorId: actor.id, version: row.version, amount: row.amount, method: row.method, status: row.status, reason: parsed.data.reason ?? "Confirmed by school leadership" } });
    if (creditAmount > 0) await tx.feeCredit.create({ data: { learnerId: payment.invoice.learnerId, sourcePaymentId: row.id, amount: creditAmount, remaining: creditAmount } });
    await tx.auditEvent.create({ data: { actorId: actor.id, action: "PAYMENT_CONFIRMED", entity: "FeePayment", entityId: id } });
    return { row, creditAmount };
  });
  return NextResponse.json({ payment: result.row, creditAmount: result.creditAmount });
}

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
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const waiverRequestSchema = z.object({
  invoiceId: z.string().cuid(),
  amount: z.number().int().positive(),
  reason: z.string().trim().min(5).max(300)
});

const waiverDecisionSchema = z.object({
  waiverId: z.string().cuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionNote: z.string().trim().max(300).optional()
});

export async function GET() {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!canInScope(user.role, "feeWaivers", "view", "school")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const waivers = await db.feeWaiver.findMany({
    include: {
      invoice: {
        select: {
          id: true,
          term: true,
          learner: { select: { id: true, name: true, admissionNo: true, grade: true } }
        }
      },
      requestedBy: { select: { id: true, name: true, role: true } },
      approvedBy: { select: { id: true, name: true, role: true } }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return NextResponse.json({ waivers });
}

export async function POST(request: Request) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  // Check if this is a request or a decision
  if (body && typeof body === "object" && "decision" in body) {
    // Decision flow (Director only)
    if (!canInScope(user.role, "feeWaivers", "approve", "school")) {
      await db.auditEvent.create({
        data: { actorId: user.id, action: "ACCESS_DENIED", entity: "FeeWaiver" }
      });
      return NextResponse.json({ error: "Only the Director can approve fee waivers." }, { status: 403 });
    }

    const parsed = waiverDecisionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid waiver decision." }, { status: 400 });

    const { waiverId, decision, decisionNote } = parsed.data;

    const updated = await db.$transaction(async (tx) => {
      const waiver = await tx.feeWaiver.findUnique({
        where: { id: waiverId },
        include: { invoice: true }
      });
      if (!waiver) throw new Error("Waiver not found.");
      if (waiver.status !== "PENDING") throw new Error("Waiver already processed.");

      const result = await tx.feeWaiver.update({
        where: { id: waiverId },
        data: {
          status: decision,
          approvedById: user.id,
          approvedAt: new Date(),
          decisionNote: decisionNote || null
        }
      });

      // If approved, apply credit adjustment to invoice
      if (decision === "APPROVED") {
        await tx.feeInvoice.update({
          where: { id: waiver.invoiceId },
          data: { creditApplied: { increment: waiver.amount } }
        });
      }

      await tx.auditEvent.create({
        data: {
          actorId: user.id,
          action: `FEE_WAIVER_${decision}`,
          entity: "FeeWaiver",
          entityId: waiverId
        }
      });

      return result;
    });

    return NextResponse.json({ waiver: updated });
  }

  // Request flow (Accountant)
  if (!canInScope(user.role, "feeWaivers", "create", "school")) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "FeeWaiver" }
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = waiverRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Provide an invoice, positive waiver amount, and reason." }, { status: 400 });
  }

  const { invoiceId, amount, reason } = parsed.data;

  const invoice = await db.feeInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

  const waiver = await db.$transaction(async (tx) => {
    const created = await tx.feeWaiver.create({
      data: {
        invoiceId,
        amount,
        reason,
        status: "PENDING",
        requestedById: user.id
      }
    });

    await tx.auditEvent.create({
      data: {
        actorId: user.id,
        action: "FEE_WAIVER_REQUESTED",
        entity: "FeeWaiver",
        entityId: created.id
      }
    });

    return created;
  });

  return NextResponse.json({ waiver }, { status: 201 });
}

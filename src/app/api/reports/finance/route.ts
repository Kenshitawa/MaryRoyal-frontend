import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { readSession } from "@/lib/session";
import { canInScope } from "@/lib/permissions";

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? "").replace(/[\r\n]/g, " ");
  const escaped = /^[=+\-@\t]/.test(str) ? `'${str}` : str;
  return `"${escaped.replaceAll('"', '""')}"`;
}

export async function GET() {
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!user || user.suspended || user.forcePasswordChange) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  if (!canInScope(user.role, "exports", "view", "school")) {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "FinanceExport" }
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoices = await db.feeInvoice.findMany({
    include: {
      learner: { select: { admissionNo: true, name: true, grade: true } },
      lines: true,
      payments: { where: { status: "RECORDED" }, select: { amount: true } }
    },
    orderBy: [{ term: "desc" }, { createdAt: "desc" }]
  });

  await db.auditEvent.create({
    data: {
      actorId: user.id,
      action: "DATA_EXPORTED",
      entity: "FeeInvoice",
      entityId: String(invoices.length)
    }
  });

  const headers = [
    "Admission Number",
    "Learner Name",
    "Class / Grade",
    "Term",
    "Total Billed (KES)",
    "Credit Applied (KES)",
    "Net Billed (KES)",
    "Total Paid (KES)",
    "Outstanding Balance (KES)",
    "Status"
  ];

  const rows = invoices.map((inv) => {
    const rawTotal = inv.lines.reduce((acc, l) => acc + l.amount, 0);
    const netBilled = Math.max(0, rawTotal - inv.creditApplied);
    const paid = inv.payments.reduce((acc, p) => acc + p.amount, 0);
    const balance = Math.max(0, netBilled - paid);
    const status = balance === 0 ? "Fully Paid" : paid > 0 ? "Partially Paid" : "Unpaid";

    return [
      escapeCsv(inv.learner.admissionNo),
      escapeCsv(inv.learner.name),
      escapeCsv(inv.learner.grade),
      escapeCsv(inv.term),
      escapeCsv(rawTotal),
      escapeCsv(inv.creditApplied),
      escapeCsv(netBilled),
      escapeCsv(paid),
      escapeCsv(balance),
      escapeCsv(status)
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=Mary-Royal-Fee-Collections-Summary.csv",
      "Cache-Control": "private, no-store"
    }
  });
}

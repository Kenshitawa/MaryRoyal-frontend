import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";

const safeText = (value: string) => value.normalize("NFKD").replace(/[^\x20-\x7E]/g, " ").slice(0, 160);

export async function GET(request: Request) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const schoolScope = canInScope(user.role, "payments", "view", "school");
  const linkedScope = canInScope(user.role, "payments", "view", "linked");
  if (!schoolScope && !linkedScope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const linkedLearnerIds = linkedScope
    ? (await db.guardianLink.findMany({ where: { userId: user.id, relation: { not: "Learner" }, learner: { archivedAt: null } }, select: { learnerId: true } })).map((link) => link.learnerId)
    : undefined;
  const rows = await db.feePayment.findMany({
    where: { status: { not: "PENDING" }, ...(linkedLearnerIds ? { invoice: { learnerId: { in: linkedLearnerIds } } } : {}) },
    select: { receiptNo: true, amount: true, method: true, status: true, createdAt: true, reference: true, mpesaCode: true, voidReason: true,
      invoice: { select: { term: true, learner: { select: { name: true, admissionNo: true, grade: true } }, lines: { select: { description: true, amount: true }, orderBy: { description: "asc" } } } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const csvCell = (value: string | number) => {
    const text = String(value).replace(/[\r\n]/g, " ");
    return `"${(/^[=+\-@\t]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`;
  };
  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv") {
    const csv = [
      ["Receipt number", "Learner", "Admission number", "Grade", "Term", "Amount KES", "Method", "Status", "Date (EAT)"].map(csvCell).join(","),
      ...rows.map((row) => [row.receiptNo, row.invoice.learner.name, row.invoice.learner.admissionNo, row.invoice.learner.grade, row.invoice.term, row.amount, row.method, row.status, new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(row.createdAt)].map(csvCell).join(",")),
    ].join("\r\n");
    await db.auditEvent.create({ data: { actorId: user.id, action: "DATA_EXPORTED", entity: "FeePaymentCSV", entityId: String(rows.length) } });
    return new Response(`\uFEFF${csv}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=Mary-Royal-Receipts-Register.csv", "Cache-Control": "private, no-store" } });
  }
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const navy = rgb(0.08, 0.19, 0.43);
  const blue = rgb(0.12, 0.31, 0.76);
  for (const receipt of rows) {
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: pageHeight - 136, width: pageWidth, height: 136, color: navy });
    page.drawText("MARY ROYAL SCHOOL", { x: 42, y: pageHeight - 52, size: 20, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Official fee receipt | Obunga, Kisumu, Kenya", { x: 42, y: pageHeight - 76, size: 10, font: regular, color: rgb(0.86, 0.91, 1) });
    page.drawText(receipt.status === "VOID" ? "VOIDED RECEIPT" : "OFFICIAL RECEIPT", { x: 42, y: pageHeight - 111, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText(safeText(receipt.receiptNo), { x: 370, y: pageHeight - 111, size: 12, font: bold, color: rgb(1, 1, 1) });
    let y = pageHeight - 176;
    const field = (label: string, value: string) => {
      page.drawText(safeText(label), { x: 44, y, size: 9, font: bold, color: blue });
      page.drawText(safeText(value), { x: 44, y: y - 18, size: 12, font: regular, color: navy });
      y -= 54;
    };
    field("LEARNER", receipt.invoice.learner.name);
    field("ADMISSION NUMBER", receipt.invoice.learner.admissionNo);
    field("CLASS AND TERM", `${receipt.invoice.learner.grade} | ${receipt.invoice.term}`);
    field("PAYMENT DATE", new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(receipt.createdAt));
    field("PAYMENT METHOD", `${receipt.method}${receipt.mpesaCode ? ` | M-PESA ${receipt.mpesaCode}` : ""}${receipt.reference ? ` | Ref ${receipt.reference}` : ""}`);
    page.drawText("FEE BREAKDOWN", { x: 44, y, size: 10, font: bold, color: blue });
    y -= 24;
    for (const line of receipt.invoice.lines) {
      if (y < 140) break;
      page.drawText(safeText(line.description), { x: 48, y, size: 10, font: regular, color: navy });
      page.drawText(`Ksh ${line.amount.toLocaleString("en-KE")}`, { x: 430, y, size: 10, font: regular, color: navy });
      y -= 19;
    }
    y -= 12;
    page.drawLine({ start: { x: 44, y }, end: { x: 551, y }, thickness: 1, color: rgb(0.78, 0.82, 0.9) });
    y -= 34;
    page.drawText("AMOUNT RECEIVED", { x: 44, y, size: 10, font: bold, color: blue });
    page.drawText(`Ksh ${receipt.amount.toLocaleString("en-KE")}`, { x: 375, y: y - 3, size: 18, font: bold, color: navy });
    if (receipt.status === "VOID") page.drawText(`Void reason: ${safeText(receipt.voidReason || "Transaction voided")}`, { x: 44, y: y - 34, size: 9, font: regular, color: rgb(0.65, 0.1, 0.18) });
    page.drawText("Keep this receipt for your records. Generated from Mary Royal School finance records.", { x: 44, y: 42, size: 8, font: regular, color: rgb(0.35, 0.4, 0.5) });
  }
  const bytes = await pdf.save();
  await db.auditEvent.create({ data: { actorId: user.id, action: "DATA_EXPORTED", entity: "FeePaymentPDF", entityId: String(rows.length) } });
  const body = new Uint8Array(bytes).buffer as ArrayBuffer;
  return new Response(body, { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=Mary-Royal-Receipts.pdf", "Cache-Control": "private, no-store" } });
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { generateQrMatrix } from "@/lib/qr";

async function actor() {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return null;
  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  return user && !user.suspended && !user.forcePasswordChange ? user : null;
}

const kes = (amount: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(amount);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await actor();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const { id } = await params;
  const payment = await db.feePayment.findUnique({
    where: { id },
    include: {
      invoice: {
        include: {
          learner: true,
          lines: true,
          payments: { where: { status: "RECORDED" }, select: { amount: true } }
        }
      },
      recordedBy: { select: { name: true } }
    }
  });

  if (!payment || payment.status === "PENDING") {
    return NextResponse.json({ error: "Receipt not available or payment pending confirmation." }, { status: 404 });
  }

  // Authorization check
  const schoolScope = canInScope(user.role, "payments", "view", "school");
  const linkedScope = canInScope(user.role, "payments", "view", "linked");
  if (!schoolScope) {
    if (!linkedScope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const link = await db.guardianLink.findUnique({
      where: { userId_learnerId: { userId: user.id, learnerId: payment.invoice.learnerId } }
    });
    if (!link) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate PDF document
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points
  const { width, height } = page.getSize();

  // Color palette
  const royalBlue = rgb(0.114, 0.306, 0.847); // #1D4ED8
  const darkNavy = rgb(0.063, 0.137, 0.247);  // #10233F
  const slateGray = rgb(0.392, 0.447, 0.541);
  const lightBg = rgb(0.961, 0.973, 0.992);
  const lightBorder = rgb(0.898, 0.925, 0.965);

  let y = height - 50;

  // Header banner
  page.drawRectangle({
    x: 40,
    y: y - 55,
    width: width - 80,
    height: 65,
    color: lightBg,
    borderColor: lightBorder,
    borderWidth: 1
  });

  let textStartX = 55;
  try {
    const logoBuffer = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
    const logoImage = await pdfDoc.embedPng(logoBuffer);
    page.drawImage(logoImage, {
      x: 52,
      y: y - 48,
      width: 48,
      height: 48
    });
    textStartX = 112;
  } catch {
    // Keep fallback position if logo file is unavailable
  }

  page.drawText("MARY ROYAL SCHOOL", {
    x: textStartX,
    y: y - 22,
    size: 16,
    font: fontBold,
    color: royalBlue
  });

  page.drawText("Obunga, Kisumu, Kenya · Motto: \"Hard work pays\" · Slogan: \"Nurturing Excellence Through CBE\"", {
    x: textStartX,
    y: y - 38,
    size: 8.5,
    font: fontRegular,
    color: slateGray
  });

  y -= 80;

  // Title and Receipt No
  page.drawText("OFFICIAL FEE RECEIPT", {
    x: 40,
    y,
    size: 18,
    font: fontBold,
    color: darkNavy
  });

  const receiptBadge = `RECEIPT NO: ${payment.receiptNo}`;
  const badgeWidth = fontBold.widthOfTextAtSize(receiptBadge, 11);
  page.drawRectangle({
    x: width - 40 - badgeWidth - 20,
    y: y - 5,
    width: badgeWidth + 20,
    height: 24,
    color: royalBlue
  });
  page.drawText(receiptBadge, {
    x: width - 40 - badgeWidth - 10,
    y: y + 2,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  y -= 30;

  // Meta box (Learner & Payment Details)
  page.drawRectangle({
    x: 40,
    y: y - 105,
    width: width - 80,
    height: 115,
    color: lightBg,
    borderColor: lightBorder,
    borderWidth: 1
  });

  const col1 = 55;
  const col2 = 310;
  let detailY = y - 10;

  page.drawText("Learner Name:", { x: col1, y: detailY, size: 9, font: fontRegular, color: slateGray });
  page.drawText(payment.invoice.learner.name, { x: col1 + 80, y: detailY, size: 10, font: fontBold, color: darkNavy });

  page.drawText("Admission No:", { x: col2, y: detailY, size: 9, font: fontRegular, color: slateGray });
  page.drawText(payment.invoice.learner.admissionNo, { x: col2 + 80, y: detailY, size: 10, font: fontBold, color: darkNavy });

  detailY -= 22;
  page.drawText("Class / Grade:", { x: col1, y: detailY, size: 9, font: fontRegular, color: slateGray });
  page.drawText(payment.invoice.learner.grade, { x: col1 + 80, y: detailY, size: 10, font: fontBold, color: darkNavy });

  page.drawText("Academic Term:", { x: col2, y: detailY, size: 9, font: fontRegular, color: slateGray });
  page.drawText(payment.invoice.term, { x: col2 + 80, y: detailY, size: 10, font: fontBold, color: darkNavy });

  detailY -= 22;
  page.drawText("Date Received:", { x: col1, y: detailY, size: 9, font: fontRegular, color: slateGray });
  const dateFormatted = new Intl.DateTimeFormat("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }).format(payment.createdAt);
  page.drawText(dateFormatted, { x: col1 + 80, y: detailY, size: 10, font: fontBold, color: darkNavy });

  page.drawText("Payment Method:", { x: col2, y: detailY, size: 9, font: fontRegular, color: slateGray });
  const methodDetail = payment.method + (payment.mpesaCode ? ` (${payment.mpesaCode})` : "") + (payment.reference ? ` · Ref: ${payment.reference}` : "");
  page.drawText(methodDetail, { x: col2 + 80, y: detailY, size: 10, font: fontBold, color: darkNavy });

  detailY -= 22;
  page.drawText("Received By:", { x: col1, y: detailY, size: 9, font: fontRegular, color: slateGray });
  page.drawText(payment.recordedBy?.name ?? "Accounts Office", { x: col1 + 80, y: detailY, size: 10, font: fontBold, color: darkNavy });

  page.drawText("Status:", { x: col2, y: detailY, size: 9, font: fontRegular, color: slateGray });
  page.drawText(payment.status === "VOID" ? "VOIDED" : "CONFIRMED & ISSUED", {
    x: col2 + 80,
    y: detailY,
    size: 10,
    font: fontBold,
    color: payment.status === "VOID" ? rgb(0.85, 0.15, 0.15) : rgb(0.1, 0.6, 0.3)
  });

  y -= 135;

  // Table header for Invoice Breakdown
  page.drawText("INVOICE ITEMS BREAKDOWN", { x: 40, y, size: 11, font: fontBold, color: darkNavy });
  y -= 15;

  page.drawRectangle({
    x: 40,
    y: y - 18,
    width: width - 80,
    height: 24,
    color: rgb(0.92, 0.94, 0.98)
  });

  page.drawText("Description", { x: 55, y: y - 10, size: 9, font: fontBold, color: darkNavy });
  page.drawText("Category", { x: 310, y: y - 10, size: 9, font: fontBold, color: darkNavy });
  page.drawText("Amount (KES)", { x: width - 120, y: y - 10, size: 9, font: fontBold, color: darkNavy });

  y -= 25;

  // Invoice Lines
  let invoiceTotal = 0;
  for (const line of payment.invoice.lines) {
    invoiceTotal += line.amount;
    page.drawText(line.description, { x: 55, y, size: 9, font: fontRegular, color: darkNavy });
    page.drawText(line.category, { x: 310, y, size: 9, font: fontRegular, color: slateGray });
    const lineAmt = kes(line.amount);
    page.drawText(lineAmt, { x: width - 50 - fontRegular.widthOfTextAtSize(lineAmt, 9), y, size: 9, font: fontRegular, color: darkNavy });

    page.drawLine({
      start: { x: 40, y: y - 6 },
      end: { x: width - 40, y: y - 6 },
      color: lightBorder,
      thickness: 0.5
    });

    y -= 20;
  }

  y -= 10;

  // Summary calculation
  const totalPaidOnInvoice = payment.invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remainingBalance = Math.max(0, invoiceTotal - totalPaidOnInvoice - payment.invoice.creditApplied);

  // Totals Box
  page.drawRectangle({
    x: width - 280,
    y: y - 75,
    width: 240,
    height: 85,
    color: lightBg,
    borderColor: royalBlue,
    borderWidth: 1.5
  });

  page.drawText("Total Invoice Due:", { x: width - 265, y: y - 18, size: 10, font: fontRegular, color: slateGray });
  page.drawText(kes(invoiceTotal), { x: width - 55 - fontRegular.widthOfTextAtSize(kes(invoiceTotal), 10), y: y - 18, size: 10, font: fontBold, color: darkNavy });

  page.drawText("THIS PAYMENT:", { x: width - 265, y: y - 40, size: 11, font: fontBold, color: royalBlue });
  page.drawText(kes(payment.amount), { x: width - 55 - fontBold.widthOfTextAtSize(kes(payment.amount), 11), y: y - 40, size: 11, font: fontBold, color: royalBlue });

  page.drawText("Remaining Balance:", { x: width - 265, y: y - 62, size: 10, font: fontRegular, color: slateGray });
  page.drawText(kes(remainingBalance), { x: width - 55 - fontRegular.widthOfTextAtSize(kes(remainingBalance), 10), y: y - 62, size: 10, font: fontBold, color: darkNavy });

  // Verification QR Code
  const qrVerificationText = `MARY-ROYAL-VERIFIED:receipt=${payment.receiptNo};adm=${payment.invoice.learner.admissionNo};amount=${payment.amount};date=${payment.createdAt.toISOString()}`;
  const qrMatrix = generateQrMatrix(qrVerificationText);
  const qrSize = 85;
  const qrX = 55;
  const qrY = y - 75;
  const moduleSize = qrSize / qrMatrix.length;

  page.drawRectangle({
    x: qrX - 5,
    y: qrY - 5,
    width: qrSize + 10,
    height: qrSize + 10,
    color: rgb(1, 1, 1),
    borderColor: lightBorder,
    borderWidth: 1
  });

  for (let r = 0; r < qrMatrix.length; r++) {
    for (let c = 0; c < qrMatrix.length; c++) {
      if (qrMatrix[r][c]) {
        page.drawRectangle({
          x: qrX + c * moduleSize,
          y: qrY + (qrMatrix.length - 1 - r) * moduleSize,
          width: moduleSize,
          height: moduleSize,
          color: darkNavy
        });
      }
    }
  }

  page.drawText("Scan to verify official receipt", {
    x: qrX + qrSize + 15,
    y: qrY + 45,
    size: 8,
    font: fontBold,
    color: royalBlue
  });
  page.drawText(`Digital verification token: ${payment.receiptNo.slice(-6)}`, {
    x: qrX + qrSize + 15,
    y: qrY + 30,
    size: 8,
    font: fontRegular,
    color: slateGray
  });

  y -= 130;

  // Signatures
  page.drawLine({
    start: { x: 55, y },
    end: { x: 230, y },
    color: darkNavy,
    thickness: 1
  });
  page.drawText("Authorized Cashier / Accountant", { x: 55, y: y - 14, size: 9, font: fontRegular, color: slateGray });

  page.drawLine({
    start: { x: width - 230, y },
    end: { x: width - 55, y },
    color: darkNavy,
    thickness: 1
  });
  page.drawText("Head Teacher / Director Sign & Stamp", { x: width - 230, y: y - 14, size: 9, font: fontRegular, color: slateGray });

  // Footer
  page.drawText("Thank you for partnering in your child's excellence at Mary Royal School.", {
    x: 40,
    y: 35,
    size: 8,
    font: fontRegular,
    color: slateGray
  });
  page.drawText("This document is an official valid receipt issued under Mary Royal School regulations.", {
    x: width - 290,
    y: 35,
    size: 8,
    font: fontRegular,
    color: slateGray
  });

  const pdfBytes = await pdfDoc.save();

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="MaryRoyal_Receipt_${payment.receiptNo}.pdf"`,
      "Cache-Control": "private, max-age=3600"
    }
  });
}

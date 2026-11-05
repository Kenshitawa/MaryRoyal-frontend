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
          learner: {
            include: {
              guardians: {
                include: {
                  user: { select: { name: true, phone: true } }
                }
              }
            }
          },
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
  pdfDoc.setTitle(`Fee Receipt - ${payment.receiptNo} · Mary Royal School`);
  pdfDoc.setAuthor("Mary Royal Primary & Junior School · Obunga, Kisumu");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 dimensions in points
  const { width, height } = page.getSize();

  // Color palette
  const royalBlue = rgb(0.114, 0.306, 0.847); // #1D4ED8
  const darkNavy = rgb(0.063, 0.137, 0.247);  // #10233F
  const goldAccent = rgb(0.85, 0.65, 0.13); // #D9A521
  const slateGray = rgb(0.392, 0.447, 0.541);
  const lightBg = rgb(0.961, 0.975, 0.995);
  const borderLight = rgb(0.87, 0.90, 0.95);
  const white = rgb(1, 1, 1);
  const emeraldGreen = rgb(0.06, 0.52, 0.25);
  const rubyRed = rgb(0.85, 0.18, 0.18);

  // Decorative Certificate Border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderColor: royalBlue,
    borderWidth: 2
  });

  page.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: goldAccent,
    borderWidth: 0.75
  });

  let y = height - 45;

  // Header banner box
  page.drawRectangle({
    x: 35,
    y: y - 72,
    width: width - 70,
    height: 72,
    color: lightBg,
    borderColor: borderLight,
    borderWidth: 1
  });

  let textStartX = 48;
  try {
    const logoBuffer = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
    const logoImage = await pdfDoc.embedPng(logoBuffer);
    page.drawImage(logoImage, {
      x: 45,
      y: y - 66,
      width: 60,
      height: 60
    });
    textStartX = 114;
  } catch {
    // Keep fallback position
  }

  // Institutional Masthead with Verified P.O. Box & Contacts
  page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", {
    x: textStartX,
    y: y - 20,
    size: 15,
    font: fontBold,
    color: darkNavy
  });

  page.drawText("P.O. Box 40100, Kisumu, Kenya · Tel: +254 718 216 374 · Email: maryroyalschool81@gmail.com", {
    x: textStartX,
    y: y - 35,
    size: 7.8,
    font: fontRegular,
    color: slateGray
  });

  page.drawText("Physical Location: Obunga (Near Breweries), Kisumu, Kenya · Finance & Bursar's Office", {
    x: textStartX,
    y: y - 47,
    size: 7.5,
    font: fontRegular,
    color: slateGray
  });

  page.drawText("Motto: \"Hard Work Pays\"  ·  Slogan: \"Nurturing Excellence Through CBE\"", {
    x: textStartX,
    y: y - 59,
    size: 7.5,
    font: fontBold,
    color: royalBlue
  });

  // Top right Receipt Badge
  page.drawRectangle({
    x: width - 162,
    y: y - 66,
    width: 127,
    height: 56,
    color: royalBlue
  });

  page.drawText("OFFICIAL RECEIPT", {
    x: width - 152,
    y: y - 26,
    size: 7.5,
    font: fontBold,
    color: goldAccent
  });

  page.drawText(payment.receiptNo, {
    x: width - 152,
    y: y - 44,
    size: 11,
    font: fontBold,
    color: white
  });

  const isVoid = payment.status === "VOID";
  page.drawText(isVoid ? "STATUS: VOIDED" : "STATUS: ISSUED & PAID", {
    x: width - 152,
    y: y - 58,
    size: 7,
    font: fontBold,
    color: isVoid ? goldAccent : white
  });

  y -= 90;

  // Title Ribbon
  page.drawRectangle({
    x: 35,
    y: y - 22,
    width: width - 70,
    height: 24,
    color: darkNavy
  });

  page.drawText("OFFICIAL STUDENT FEE PAYMENT RECEIPT", {
    x: 165,
    y: y - 15,
    size: 10,
    font: fontBold,
    color: white
  });

  y -= 38;

  // Meta box (Learner & Transaction Details)
  page.drawRectangle({
    x: 35,
    y: y - 88,
    width: width - 70,
    height: 88,
    color: lightBg,
    borderColor: borderLight,
    borderWidth: 1
  });

  const col1 = 45;
  const col2 = 310;
  let detailY = y - 16;

  page.drawText("Learner Name:", { x: col1, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(payment.invoice.learner.name, { x: col1 + 80, y: detailY, size: 9, font: fontBold, color: darkNavy });

  page.drawText("Admission No:", { x: col2, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(payment.invoice.learner.admissionNo, { x: col2 + 85, y: detailY, size: 9, font: fontBold, color: darkNavy });

  detailY -= 18;
  page.drawText("Class / Grade:", { x: col1, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(payment.invoice.learner.grade, { x: col1 + 80, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Academic Term:", { x: col2, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(payment.invoice.term, { x: col2 + 85, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  detailY -= 18;
  page.drawText("Date Received:", { x: col1, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  const dateFormatted = new Intl.DateTimeFormat("en-KE", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(payment.createdAt);
  page.drawText(dateFormatted, { x: col1 + 80, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Payment Method:", { x: col2, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  const methodDetail = payment.method + (payment.mpesaCode ? ` (${payment.mpesaCode})` : "") + (payment.reference ? ` · Ref: ${payment.reference}` : "");
  page.drawText(methodDetail, { x: col2 + 85, y: detailY, size: 8.5, font: fontBold, color: darkNavy });

  detailY -= 18;
  page.drawText("Received By:", { x: col1, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(payment.recordedBy?.name ?? "Finance Office", { x: col1 + 80, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Payment Status:", { x: col2, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(isVoid ? "VOIDED / CANCELLED" : "CONFIRMED & CLEARED", {
    x: col2 + 85,
    y: detailY,
    size: 8.5,
    font: fontBold,
    color: isVoid ? rubyRed : emeraldGreen
  });

  y -= 105;

  // Table header for Invoice Breakdown
  page.drawText("INVOICE PARTICULARS & FEE BREAKDOWN", { x: 35, y, size: 9.5, font: fontBold, color: darkNavy });
  y -= 14;

  page.drawRectangle({
    x: 35,
    y: y - 18,
    width: width - 70,
    height: 20,
    color: royalBlue
  });

  page.drawText("DESCRIPTION / FEE ITEM", { x: 45, y: y - 12, size: 8, font: fontBold, color: white });
  page.drawText("CATEGORY", { x: 310, y: y - 12, size: 8, font: fontBold, color: white });
  page.drawText("AMOUNT (KES)", { x: width - 125, y: y - 12, size: 8, font: fontBold, color: white });

  y -= 22;

  // Invoice Lines
  let invoiceTotal = 0;
  for (const [idx, line] of payment.invoice.lines.entries()) {
    invoiceTotal += line.amount;
    const rowBg = idx % 2 === 0 ? white : rgb(0.98, 0.985, 0.995);

    page.drawRectangle({
      x: 35,
      y: y - 14,
      width: width - 70,
      height: 18,
      color: rowBg,
      borderColor: borderLight,
      borderWidth: 0.5
    });

    page.drawText(line.description, { x: 45, y: y - 8, size: 8, font: fontRegular, color: darkNavy });
    page.drawText(line.category, { x: 310, y: y - 8, size: 7.5, font: fontRegular, color: slateGray });
    const lineAmt = kes(line.amount);
    page.drawText(lineAmt, { x: width - 45 - fontRegular.widthOfTextAtSize(lineAmt, 8), y: y - 8, size: 8, font: fontBold, color: darkNavy });

    y -= 18;
  }

  y -= 12;

  // Summary calculation
  const totalPaidOnInvoice = payment.invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remainingBalance = Math.max(0, invoiceTotal - totalPaidOnInvoice - payment.invoice.creditApplied);

  // Totals Box (Right)
  const totalsBoxW = 240;
  const totalsBoxX = width - 35 - totalsBoxW;
  page.drawRectangle({
    x: totalsBoxX,
    y: y - 76,
    width: totalsBoxW,
    height: 76,
    color: rgb(0.93, 0.96, 1.0),
    borderColor: royalBlue,
    borderWidth: 1.2
  });

  page.drawText("Total Invoice Incurred:", { x: totalsBoxX + 12, y: y - 18, size: 8.5, font: fontRegular, color: slateGray });
  page.drawText(kes(invoiceTotal), { x: width - 45 - fontRegular.widthOfTextAtSize(kes(invoiceTotal), 8.5), y: y - 18, size: 8.5, font: fontBold, color: darkNavy });

  page.drawText("AMOUNT PAID (THIS RECEIPT):", { x: totalsBoxX + 12, y: y - 38, size: 9, font: fontBold, color: royalBlue });
  page.drawText(kes(payment.amount), { x: width - 45 - fontBold.widthOfTextAtSize(kes(payment.amount), 10), y: y - 38, size: 10, font: fontBold, color: royalBlue });

  page.drawText("Remaining Term Balance:", { x: totalsBoxX + 12, y: y - 58, size: 8.5, font: fontRegular, color: slateGray });
  const balColor = remainingBalance > 0 ? rubyRed : emeraldGreen;
  page.drawText(kes(remainingBalance), { x: width - 45 - fontBold.widthOfTextAtSize(kes(remainingBalance), 9), y: y - 58, size: 9, font: fontBold, color: balColor });

  // Verification QR Code (Left)
  const qrVerificationText = `MARY-ROYAL-VERIFIED:receipt=${payment.receiptNo};adm=${payment.invoice.learner.admissionNo};amount=${payment.amount};date=${payment.createdAt.toISOString()}`;
  const qrMatrix = generateQrMatrix(qrVerificationText);
  const qrSize = 65;
  const qrX = 45;
  const qrY = y - 70;
  const moduleSize = qrSize / qrMatrix.length;

  page.drawRectangle({
    x: qrX - 4,
    y: qrY - 4,
    width: qrSize + 8,
    height: qrSize + 8,
    color: white,
    borderColor: borderLight,
    borderWidth: 1
  });

  for (let r = 0; r < qrMatrix.length; r++) {
    for (let c = 0; c < qrMatrix[r].length; c++) {
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

  page.drawText("Authentic Digital Receipt", {
    x: qrX + qrSize + 12,
    y: qrY + 40,
    size: 7.5,
    font: fontBold,
    color: royalBlue
  });
  page.drawText(`Token: ${payment.receiptNo.slice(-6).toUpperCase()} · Tamper-proof`, {
    x: qrX + qrSize + 12,
    y: qrY + 28,
    size: 7,
    font: fontRegular,
    color: slateGray
  });
  page.drawText("Scan with any camera to verify validity", {
    x: qrX + qrSize + 12,
    y: qrY + 16,
    size: 6.8,
    font: fontRegular,
    color: slateGray
  });

  y -= 110;

  // Terms & Conditions Banner
  page.drawRectangle({
    x: 35,
    y: y - 26,
    width: width - 70,
    height: 26,
    color: lightBg,
    borderColor: borderLight,
    borderWidth: 0.5
  });

  page.drawText("NOTICE: Fees once paid are non-refundable and non-transferable. Retain this receipt as official proof of payment.", {
    x: 42,
    y: y - 11,
    size: 7.2,
    font: fontBold,
    color: darkNavy
  });
  page.drawText("Payment made through official channels: Mary Royal School Bank Account or Verified School M-Pesa Till / Paybill.", {
    x: 42,
    y: y - 21,
    size: 6.8,
    font: fontRegular,
    color: slateGray
  });

  y -= 45;

  // Signatures & Stamp
  page.drawLine({
    start: { x: 45, y },
    end: { x: 220, y },
    color: slateGray,
    thickness: 0.5
  });
  page.drawText("Authorized Bursar / Accountant Stamp & Sign", { x: 45, y: y - 12, size: 7.5, font: fontRegular, color: slateGray });

  page.drawLine({
    start: { x: width - 220, y },
    end: { x: width - 45, y },
    color: slateGray,
    thickness: 0.5
  });
  page.drawText("Head Teacher / Director Official Endorsement", { x: width - 220, y: y - 12, size: 7.5, font: fontRegular, color: slateGray });

  // Footer microprint
  const printTimestamp = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi"
  }).format(new Date());

  page.drawText(`Mary Royal Primary & Junior School · P.O. Box 40100, Kisumu · Official Finance Document · Generated ${printTimestamp} EAT`, {
    x: 35,
    y: 28,
    size: 7,
    font: fontRegular,
    color: slateGray
  });

  const pdfBytes = await pdfDoc.save();

  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="MaryRoyal-Receipt-${payment.receiptNo}.pdf"`,
      "Cache-Control": "private, max-age=3600"
    }
  });
}

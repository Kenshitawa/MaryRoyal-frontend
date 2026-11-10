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
  const token = (await cookies()).get("school_session")?.value;
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
  const invoice = await db.feeInvoice.findUnique({
    where: { id },
    include: {
      learner: {
        include: {
          guardians: {
            include: {
              user: { select: { name: true, phone: true, email: true } }
            }
          }
        }
      },
      lines: true,
      payments: { where: { status: "RECORDED" }, select: { amount: true, receiptNo: true, createdAt: true, method: true } },
      createdBy: { select: { name: true } }
    }
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  // Authorization check
  const schoolScope = canInScope(user.role, "finance", "view", "school");
  const linkedScope = canInScope(user.role, "finance", "view", "linked");
  if (!schoolScope) {
    if (!linkedScope) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const isLinked = invoice.learner.guardians.some((g) => g.userId === user.id);
    if (!isLinked) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate PDF document
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Fee Invoice - ${invoice.term} - ${invoice.learner.name}`);
  pdfDoc.setAuthor("Mary Royal Primary & Junior School Â· Obunga, Kisumu");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  // Palette
  const royalBlue = rgb(0.114, 0.306, 0.847);
  const darkNavy = rgb(0.063, 0.137, 0.247);
  const goldAccent = rgb(0.85, 0.65, 0.13);
  const slateGray = rgb(0.392, 0.447, 0.541);
  const lightBg = rgb(0.961, 0.975, 0.995);
  const borderLight = rgb(0.87, 0.90, 0.95);
  const white = rgb(1, 1, 1);
  const rubyRed = rgb(0.85, 0.18, 0.18);
  const emeraldGreen = rgb(0.06, 0.52, 0.25);

  // Certificate Double Border
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
  } catch {}

  page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", {
    x: textStartX,
    y: y - 20,
    size: 15,
    font: fontBold,
    color: darkNavy
  });

  page.drawText("P.O. Box 40100, Kisumu, Kenya Â· Tel: +254 718 216 374 Â· Email: maryroyalschool81@gmail.com", {
    x: textStartX,
    y: y - 35,
    size: 7.8,
    font: fontRegular,
    color: slateGray
  });

  page.drawText("Physical Location: Obunga (Near Breweries), Kisumu, Kenya Â· Finance & Bursar's Office", {
    x: textStartX,
    y: y - 47,
    size: 7.5,
    font: fontRegular,
    color: slateGray
  });

  page.drawText("Motto: \"Hard Work Pays\"  Â·  Slogan: \"Nurturing Excellence Through CBE\"", {
    x: textStartX,
    y: y - 59,
    size: 7.5,
    font: fontBold,
    color: royalBlue
  });

  // Top right Invoice Badge
  page.drawRectangle({
    x: width - 162,
    y: y - 66,
    width: 127,
    height: 56,
    color: royalBlue
  });

  page.drawText("FEES INVOICE", {
    x: width - 152,
    y: y - 26,
    size: 7.5,
    font: fontBold,
    color: goldAccent
  });

  page.drawText(invoice.term.toUpperCase(), {
    x: width - 152,
    y: y - 44,
    size: 11,
    font: fontBold,
    color: white
  });

  page.drawText(`STATUS: ${invoice.status}`, {
    x: width - 152,
    y: y - 58,
    size: 7,
    font: fontBold,
    color: white
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

  page.drawText("OFFICIAL STUDENT FEE INVOICE & DEMAND STATEMENT", {
    x: 145,
    y: y - 15,
    size: 10,
    font: fontBold,
    color: white
  });

  y -= 38;

  // Meta box (Learner & Invoice Particulars)
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
  page.drawText(invoice.learner.name, { x: col1 + 80, y: detailY, size: 9, font: fontBold, color: darkNavy });

  page.drawText("Admission No:", { x: col2, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(invoice.learner.admissionNo, { x: col2 + 85, y: detailY, size: 9, font: fontBold, color: darkNavy });

  detailY -= 18;
  page.drawText("Class / Grade:", { x: col1, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(invoice.learner.grade, { x: col1 + 80, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Academic Term:", { x: col2, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(invoice.term, { x: col2 + 85, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  detailY -= 18;
  page.drawText("Date Invoiced:", { x: col1, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  const dateFormatted = new Intl.DateTimeFormat("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }).format(invoice.createdAt);
  page.drawText(dateFormatted, { x: col1 + 80, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Due Date:", { x: col2, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  const dueFormatted = invoice.dueAt
    ? new Intl.DateTimeFormat("en-KE", { dateStyle: "long", timeZone: "Africa/Nairobi" }).format(invoice.dueAt)
    : "Upon Term Commencement";
  page.drawText(dueFormatted, { x: col2 + 85, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  detailY -= 18;
  page.drawText("Prepared By:", { x: col1, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(invoice.createdBy?.name ?? "Finance & Accounts", { x: col1 + 80, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Primary Guardian:", { x: col2, y: detailY, size: 8.5, font: fontBold, color: slateGray });
  const primaryG = invoice.learner.guardians?.[0]?.user?.name ?? "Parent / Guardian";
  page.drawText(primaryG, { x: col2 + 85, y: detailY, size: 8.5, font: fontRegular, color: darkNavy });

  y -= 105;

  // Table header for Invoice Breakdown
  page.drawText("SCHEDULE OF PRESCRIBED FEES & LEVIES", { x: 35, y, size: 9.5, font: fontBold, color: darkNavy });
  y -= 14;

  page.drawRectangle({
    x: 35,
    y: y - 18,
    width: width - 70,
    height: 20,
    color: royalBlue
  });

  page.drawText("DESCRIPTION / FEE AREA", { x: 45, y: y - 12, size: 8, font: fontBold, color: white });
  page.drawText("CATEGORY", { x: 310, y: y - 12, size: 8, font: fontBold, color: white });
  page.drawText("AMOUNT (KES)", { x: width - 125, y: y - 12, size: 8, font: fontBold, color: white });

  y -= 22;

  // Invoice Lines
  let invoiceTotal = 0;
  for (const [idx, line] of invoice.lines.entries()) {
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
  const totalPaid = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const remainingBalance = Math.max(0, invoiceTotal - totalPaid - invoice.creditApplied);

  // Totals Box (Right)
  const totalsBoxW = 240;
  const totalsBoxX = width - 35 - totalsBoxW;
  page.drawRectangle({
    x: totalsBoxX,
    y: y - 80,
    width: totalsBoxW,
    height: 80,
    color: rgb(0.93, 0.96, 1.0),
    borderColor: royalBlue,
    borderWidth: 1.2
  });

  page.drawText("Total Term Invoiced:", { x: totalsBoxX + 12, y: y - 18, size: 8.5, font: fontRegular, color: slateGray });
  page.drawText(kes(invoiceTotal), { x: width - 45 - fontRegular.widthOfTextAtSize(kes(invoiceTotal), 8.5), y: y - 18, size: 8.5, font: fontBold, color: darkNavy });

  page.drawText("Prior Credits Applied:", { x: totalsBoxX + 12, y: y - 36, size: 8.5, font: fontRegular, color: slateGray });
  page.drawText(kes(invoice.creditApplied), { x: width - 45 - fontRegular.widthOfTextAtSize(kes(invoice.creditApplied), 8.5), y: y - 36, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Cleared Payments to Date:", { x: totalsBoxX + 12, y: y - 52, size: 8.5, font: fontRegular, color: slateGray });
  page.drawText(kes(totalPaid), { x: width - 45 - fontRegular.widthOfTextAtSize(kes(totalPaid), 8.5), y: y - 52, size: 8.5, font: fontBold, color: emeraldGreen });

  page.drawText("NET PAYABLE BALANCE:", { x: totalsBoxX + 12, y: y - 68, size: 9, font: fontBold, color: royalBlue });
  const balColor = remainingBalance > 0 ? rubyRed : emeraldGreen;
  page.drawText(kes(remainingBalance), { x: width - 45 - fontBold.widthOfTextAtSize(kes(remainingBalance), 10), y: y - 68, size: 10, font: fontBold, color: balColor });

  // Payment Instructions (Left)
  page.drawRectangle({
    x: 35,
    y: y - 80,
    width: width - 70 - totalsBoxW - 15,
    height: 80,
    color: lightBg,
    borderColor: borderLight,
    borderWidth: 1
  });

  page.drawText("BANK & M-PESA PAYMENT MODES", { x: 45, y: y - 16, size: 8, font: fontBold, color: royalBlue });
  page.drawText("â€¢ M-Pesa Till / Paybill: Mary Royal School Kisumu", { x: 45, y: y - 30, size: 7.5, font: fontRegular, color: darkNavy });
  page.drawText(`â€¢ Account Reference: ${invoice.learner.admissionNo} (Always use Learner ADM No)`, { x: 45, y: y - 44, size: 7.5, font: fontBold, color: darkNavy });
  page.drawText("â€¢ Direct Bank Deposit: Official School Account (Cooperative Bank)", { x: 45, y: y - 58, size: 7.5, font: fontRegular, color: darkNavy });
  page.drawText("â€¢ Present bank deposit slip or M-Pesa reference for immediate receipting.", { x: 45, y: y - 72, size: 7.2, font: fontRegular, color: slateGray });

  y -= 105;

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

  page.drawText("NOTICE: Fees are due on or before the first day of each term. Receipts are issued strictly upon bank/M-Pesa confirmation.", {
    x: 42,
    y: y - 11,
    size: 7.2,
    font: fontBold,
    color: darkNavy
  });
  page.drawText("For fee queries or flexible payment plan inquiries, contact the Finance Office: +254 718 216 374.", {
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

  // Verification QR Code
  try {
    const qrData = `MARY_ROYAL_INVOICE:${invoice.id}:${invoice.learner.admissionNo}:${invoice.term}:${remainingBalance}`;
    const qrMatrix = generateQrMatrix(qrData);
    const qrSize = 52;
    const qrPixelSize = qrSize / qrMatrix.length;
    const qrX = width - 40 - qrSize;
    const qrY = 32;

    for (let r = 0; r < qrMatrix.length; r++) {
      for (let c = 0; c < qrMatrix[r].length; c++) {
        if (qrMatrix[r][c]) {
          page.drawRectangle({
            x: qrX + c * qrPixelSize,
            y: qrY + (qrMatrix.length - 1 - r) * qrPixelSize,
            width: qrPixelSize,
            height: qrPixelSize,
            color: darkNavy
          });
        }
      }
    }
    page.drawText("Scan to verify", { x: qrX - 2, y: qrY - 8, size: 6.5, font: fontRegular, color: slateGray });
  } catch {}

  // Footer microprint
  const printTimestamp = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi"
  }).format(new Date());

  page.drawText(`Mary Royal Primary & Junior School Â· P.O. Box 40100, Kisumu Â· Official Finance Invoice Â· Generated ${printTimestamp} EAT`, {
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
      "Content-Disposition": `inline; filename="MaryRoyal-Invoice-${invoice.term}-${invoice.learner.admissionNo}.pdf"`,
      "Cache-Control": "private, max-age=3600"
    }
  });
}

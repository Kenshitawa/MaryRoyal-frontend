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
  const entry = await db.payrollEntry.findUnique({
    where: { id },
    include: {
      staff: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          staffNumber: true,
          tscNumber: true,
          employmentTitle: true,
          role: true
        }
      },
      enteredBy: { select: { name: true, role: true } }
    }
  });

  if (!entry) {
    return NextResponse.json({ error: "Payroll slip not found." }, { status: 404 });
  }

  // Authorization: Director, Head Teacher, Accountant can view all. Individual staff can view their own.
  const canManagePayroll = canInScope(user.role, "finance", "view", "school") ||
    user.role === "DIRECTOR" || user.role === "HEAD_TEACHER" || user.role === "ACCOUNTANT";
  const isOwnSlip = user.id === entry.staffId;

  if (!canManagePayroll && !isOwnSlip) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate PDF document
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Staff Pay Slip - ${entry.staff.name} (${entry.period})`);
  pdfDoc.setAuthor("Mary Royal School - Obunga, Kisumu");

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
  const successGreen = rgb(0.06, 0.53, 0.34);
  const dangerRed = rgb(0.85, 0.20, 0.20);

  let y = height - 45;

  // Header banner
  page.drawRectangle({
    x: 40,
    y: y - 62,
    width: width - 80,
    height: 72,
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
      y: y - 56,
      width: 56,
      height: 56
    });
    textStartX = 120;
  } catch {
    // Keep fallback position if logo file is unavailable
  }

  page.drawText("MARY ROYAL SCHOOL", {
    x: textStartX,
    y: y - 20,
    size: 16,
    font: fontBold,
    color: royalBlue
  });

  page.drawText("Obunga, Kisumu, Kenya · Motto: \"Hard work pays\" · Slogan: \"Nurturing Excellence Through CBE\"", {
    x: textStartX,
    y: y - 36,
    size: 8.5,
    font: fontRegular,
    color: slateGray
  });

  page.drawText("Human Resources & Finance Department · P.O. Box Obunga, Kisumu", {
    x: textStartX,
    y: y - 50,
    size: 8,
    font: fontRegular,
    color: slateGray
  });

  y -= 90;

  // Document Title & Badge
  page.drawText("OFFICIAL SALARY & REMUNERATION SLIP", {
    x: 40,
    y,
    size: 16,
    font: fontBold,
    color: darkNavy
  });

  const periodBadge = `PAY PERIOD: ${entry.period}`;
  const badgeWidth = fontBold.widthOfTextAtSize(periodBadge, 10);
  page.drawRectangle({
    x: width - 40 - badgeWidth - 20,
    y: y - 5,
    width: badgeWidth + 20,
    height: 24,
    color: royalBlue
  });
  page.drawText(periodBadge, {
    x: width - 40 - badgeWidth - 10,
    y: y + 2,
    size: 10,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  y -= 30;

  // Staff Metadata Card
  page.drawRectangle({
    x: 40,
    y: y - 85,
    width: width - 80,
    height: 95,
    color: lightBg,
    borderColor: lightBorder,
    borderWidth: 1
  });

  const staff = entry.staff;
  const leftX = 55;
  const midX = 300;

  page.drawText("STAFF DETAILS", { x: leftX, y: y - 16, size: 9, font: fontBold, color: royalBlue });

  page.drawText("Staff Name:", { x: leftX, y: y - 34, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(staff.name, { x: leftX + 80, y: y - 34, size: 9, font: fontBold, color: darkNavy });

  page.drawText("Staff ID / No:", { x: leftX, y: y - 50, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(staff.staffNumber || staff.id.slice(0, 10).toUpperCase(), { x: leftX + 80, y: y - 50, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Designation:", { x: leftX, y: y - 66, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(staff.employmentTitle || staff.role.replace(/_/g, " "), { x: leftX + 80, y: y - 66, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("TSC Number:", { x: midX, y: y - 34, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(staff.tscNumber || "N/A", { x: midX + 85, y: y - 34, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Email / Phone:", { x: midX, y: y - 50, size: 8.5, font: fontBold, color: slateGray });
  page.drawText(`${staff.email} ${staff.phone ? `· ${staff.phone}` : ""}`, { x: midX + 85, y: y - 50, size: 8.5, font: fontRegular, color: darkNavy });

  page.drawText("Disbursement:", { x: midX, y: y - 66, size: 8.5, font: fontBold, color: slateGray });
  const statusColor = entry.status === "PAID" ? successGreen : rgb(0.8, 0.5, 0.0);
  page.drawText(`${entry.status} ${entry.reference ? `(${entry.reference})` : ""}`, { x: midX + 85, y: y - 66, size: 8.5, font: fontBold, color: statusColor });

  y -= 115;

  // Earnings & Remuneration Table
  page.drawText("EARNINGS & REMUNERATION", { x: 40, y, size: 11, font: fontBold, color: darkNavy });
  y -= 18;

  // Table header
  page.drawRectangle({ x: 40, y: y - 16, width: width - 80, height: 22, color: royalBlue });
  page.drawText("DESCRIPTION", { x: 50, y: y - 10, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("TYPE", { x: 300, y: y - 10, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("AMOUNT (KES)", { x: width - 130, y: y - 10, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  y -= 24;

  // Gross line
  page.drawRectangle({ x: 40, y: y - 16, width: width - 80, height: 22, color: rgb(0.98, 0.98, 0.99) });
  page.drawText("Basic Salary & Allowances", { x: 50, y: y - 10, size: 9, font: fontBold, color: darkNavy });
  page.drawText("Gross Remuneration", { x: 300, y: y - 10, size: 8.5, font: fontRegular, color: slateGray });
  page.drawText(kes(entry.grossAmount), { x: width - 130, y: y - 10, size: 9, font: fontBold, color: darkNavy });
  y -= 26;

  // Total Gross summary line
  page.drawRectangle({ x: 40, y: y - 16, width: width - 80, height: 20, color: lightBg, borderColor: lightBorder, borderWidth: 0.5 });
  page.drawText("TOTAL GROSS PAY", { x: 50, y: y - 10, size: 8.5, font: fontBold, color: royalBlue });
  page.drawText(kes(entry.grossAmount), { x: width - 130, y: y - 10, size: 8.5, font: fontBold, color: royalBlue });
  y -= 38;

  // Deductions Table
  page.drawText("STATUTORY & VOLUNTARY DEDUCTIONS", { x: 40, y, size: 11, font: fontBold, color: darkNavy });
  y -= 18;

  page.drawRectangle({ x: 40, y: y - 16, width: width - 80, height: 22, color: royalBlue });
  page.drawText("DESCRIPTION", { x: 50, y: y - 10, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("TYPE", { x: 300, y: y - 10, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  page.drawText("AMOUNT (KES)", { x: width - 130, y: y - 10, size: 8.5, font: fontBold, color: rgb(1, 1, 1) });
  y -= 24;

  page.drawRectangle({ x: 40, y: y - 16, width: width - 80, height: 22, color: rgb(0.98, 0.98, 0.99) });
  page.drawText("Statutory & Administrative Deductions (PAYE, NSSF, SHIF)", { x: 50, y: y - 10, size: 8.5, font: fontRegular, color: darkNavy });
  page.drawText("Statutory", { x: 300, y: y - 10, size: 8.5, font: fontRegular, color: slateGray });
  page.drawText(kes(entry.deductions), { x: width - 130, y: y - 10, size: 9, font: fontBold, color: dangerRed });
  y -= 26;

  page.drawRectangle({ x: 40, y: y - 16, width: width - 80, height: 20, color: lightBg, borderColor: lightBorder, borderWidth: 0.5 });
  page.drawText("TOTAL DEDUCTIONS", { x: 50, y: y - 10, size: 8.5, font: fontBold, color: dangerRed });
  page.drawText(kes(entry.deductions), { x: width - 130, y: y - 10, size: 8.5, font: fontBold, color: dangerRed });
  y -= 38;

  // Net Pay Highlight Card
  page.drawRectangle({
    x: 40,
    y: y - 48,
    width: width - 80,
    height: 52,
    color: rgb(0.93, 0.96, 1.0),
    borderColor: royalBlue,
    borderWidth: 1.5
  });

  page.drawText("NET DISBURSEMENT PAYABLE", {
    x: 55,
    y: y - 22,
    size: 11,
    font: fontBold,
    color: royalBlue
  });

  page.drawText("Amount disbursed to staff bank account / mobile money", {
    x: 55,
    y: y - 38,
    size: 8,
    font: fontRegular,
    color: slateGray
  });

  const netText = kes(entry.netAmount);
  page.drawText(netText, {
    x: width - 60 - fontBold.widthOfTextAtSize(netText, 16),
    y: y - 30,
    size: 16,
    font: fontBold,
    color: darkNavy
  });

  y -= 85;

  // Verification & Sign-off Section
  page.drawText("AUTHORIZATION & VERIFICATION", { x: 40, y, size: 9, font: fontBold, color: darkNavy });
  y -= 8;

  page.drawLine({
    start: { x: 40, y },
    end: { x: width - 40, y },
    thickness: 0.5,
    color: lightBorder
  });

  y -= 20;

  // Signatures
  page.drawText("Prepared by:", { x: 45, y, size: 8, font: fontBold, color: slateGray });
  page.drawText(entry.enteredBy?.name || "Accountant", { x: 45, y: y - 14, size: 8.5, font: fontRegular, color: darkNavy });
  page.drawLine({ start: { x: 45, y: y - 35 }, end: { x: 180, y: y - 35 }, thickness: 0.5, color: slateGray });
  page.drawText("Finance / Bursar Sign & Stamp", { x: 45, y: y - 45, size: 7.5, font: fontRegular, color: slateGray });

  page.drawText("Authorized by:", { x: 220, y, size: 8, font: fontBold, color: slateGray });
  page.drawText("Head Teacher / Director", { x: 220, y: y - 14, size: 8.5, font: fontRegular, color: darkNavy });
  page.drawLine({ start: { x: 220, y: y - 35 }, end: { x: 355, y: y - 35 }, thickness: 0.5, color: slateGray });
  page.drawText("Director / HT Sign & Date", { x: 220, y: y - 45, size: 7.5, font: fontRegular, color: slateGray });

  page.drawText("Employee Acknowledgment:", { x: 395, y, size: 8, font: fontBold, color: slateGray });
  page.drawText(staff.name, { x: 395, y: y - 14, size: 8.5, font: fontRegular, color: darkNavy });
  page.drawLine({ start: { x: 395, y: y - 35 }, end: { x: width - 45, y: y - 35 }, thickness: 0.5, color: slateGray });
  page.drawText("Employee Signature & Date", { x: 395, y: y - 45, size: 7.5, font: fontRegular, color: slateGray });

  // QR Code for authenticity verification
  try {
    const qrData = `MARY_ROYAL_PAYSLIP:${entry.id}:${entry.staffId}:${entry.period}:${entry.netAmount}`;
    const qrMatrix = generateQrMatrix(qrData);
    const qrSize = 54;
    const qrPixelSize = qrSize / qrMatrix.length;
    const qrX = width - 40 - qrSize;
    const qrY = 45;

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
    page.drawText("Scan to verify", {
      x: qrX - 2,
      y: qrY - 10,
      size: 7,
      font: fontRegular,
      color: slateGray
    });
  } catch {
    // QR is optional
  }

  // Footer microprint
  page.drawText(
    `Official Mary Royal School System Document · Generated on ${new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }).format(new Date())} · Obunga, Kisumu`,
    {
      x: 40,
      y: 42,
      size: 7.5,
      font: fontRegular,
      color: slateGray
    }
  );

  page.drawText(
    "This pay slip is an official confidential record of Mary Royal School, Kisumu. Alteration or unauthorized reproduction is strictly prohibited.",
    {
      x: 40,
      y: 30,
      size: 7,
      font: fontRegular,
      color: slateGray
    }
  );

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="MaryRoyal-PaySlip-${entry.period}-${entry.staff.name.replace(/\s+/g, "_")}.pdf"`
    }
  });
}

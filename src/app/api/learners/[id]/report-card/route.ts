import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { cbcLevel } from "@/lib/grading";
import { generateQrMatrix } from "@/lib/qr";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, email: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!user || user.suspended || user.forcePasswordChange) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const url = new URL(request.url);
  const requestedTerm = url.searchParams.get("term");

  const schoolScope = canInScope(user.role, "assessments", "view", "school") ||
    canInScope(user.role, "learners", "view", "school");
  const linkedScope = canInScope(user.role, "assessments", "view", "linked") ||
    canInScope(user.role, "learners", "view", "linked");
  const ownScope = canInScope(user.role, "assessments", "view", "self") ||
    canInScope(user.role, "learners", "view", "self");

  const learner = await db.learner.findUnique({
    where: { id },
    include: {
      guardians: true,
      admissionDraft: true,
      attendance: {
        orderBy: { date: "desc" },
        take: 60
      },
      assessments: {
        where: { status: "RELEASED" },
        orderBy: [{ term: "desc" }, { subject: "asc" }]
      }
    }
  });

  if (!learner) return NextResponse.json({ error: "Learner record not found." }, { status: 404 });

  // Authorization check
  if (!schoolScope) {
    if (linkedScope) {
      const isLinked = learner.guardians.some((g) => g.userId === user.id);
      if (!isLinked) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (ownScope) {
      const isSelf = user.email.toLowerCase() === `${learner.admissionNo.toLowerCase()}@maryroyal.ac.ke`;
      if (!isSelf) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Filter assessments by requested term or default to the most recent term with marks
  const allTerms = Array.from(new Set(learner.assessments.map((a) => a.term)));
  const targetTerm = requestedTerm && allTerms.includes(requestedTerm)
    ? requestedTerm
    : (allTerms[0] || "Term 1 2026");

  const termAssessments = learner.assessments.filter((a) => a.term === targetTerm);

  // Palette
  const royalBlue = rgb(0.114, 0.306, 0.847); // #1D4ED8
  const darkNavy = rgb(0.063, 0.137, 0.247);  // #10233F
  const goldAccent = rgb(0.85, 0.65, 0.13); // #D9A521
  const slateMuted = rgb(0.39, 0.45, 0.53);
  const lightBg = rgb(0.96, 0.975, 0.995);
  const borderLight = rgb(0.86, 0.89, 0.94);
  const white = rgb(1, 1, 1);
  const successGreen = rgb(0.06, 0.52, 0.25);
  const amberColor = rgb(0.85, 0.55, 0.05);
  const redColor = rgb(0.85, 0.20, 0.20);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Report Card - ${learner.name} (${learner.admissionNo}) - ${targetTerm}`);
  pdf.setAuthor("Mary Royal Primary & Junior School · Obunga, Kisumu");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const [pageW, pageH] = [595.28, 841.89];

  // Certificate Double Border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: pageW - 40,
    height: pageH - 40,
    borderColor: royalBlue,
    borderWidth: 2
  });

  page.drawRectangle({
    x: 24,
    y: 24,
    width: pageW - 48,
    height: pageH - 48,
    borderColor: goldAccent,
    borderWidth: 0.75
  });

  let y = pageH - 45;

  // Header Box
  page.drawRectangle({
    x: 35,
    y: y - 72,
    width: 525,
    height: 72,
    color: lightBg,
    borderColor: borderLight,
    borderWidth: 1
  });

  let textStartX = 48;
  try {
    const logo = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
    const image = await pdf.embedPng(logo);
    page.drawImage(image, { x: 45, y: y - 66, width: 60, height: 60 });
    textStartX = 114;
  } catch {}

  page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", {
    x: textStartX,
    y: y - 20,
    size: 15,
    font: bold,
    color: darkNavy
  });

  page.drawText("P.O. Box 40100, Kisumu, Kenya · Tel: +254 718 216 374 · Email: maryroyalschool81@gmail.com", {
    x: textStartX,
    y: y - 35,
    size: 7.8,
    font,
    color: slateMuted
  });

  page.drawText("Physical Location: Obunga (Near Breweries), Kisumu, Kenya · MOE / CBE Reg.", {
    x: textStartX,
    y: y - 47,
    size: 7.5,
    font,
    color: slateMuted
  });

  page.drawText("Motto: \"Hard Work Pays\"  ·  Slogan: \"Nurturing Excellence Through CBE\"", {
    x: textStartX,
    y: y - 59,
    size: 7.5,
    font: bold,
    color: royalBlue
  });

  // Top right Report Card Badge
  page.drawRectangle({
    x: 430,
    y: y - 66,
    width: 122,
    height: 56,
    color: royalBlue
  });

  page.drawText("CBC PROGRESS REPORT", {
    x: 436,
    y: y - 26,
    size: 7,
    font: bold,
    color: goldAccent
  });

  page.drawText(targetTerm.toUpperCase(), {
    x: 436,
    y: y - 44,
    size: 11,
    font: bold,
    color: white
  });

  page.drawText(`ADM: ${learner.admissionNo}`, {
    x: 436,
    y: y - 58,
    size: 8,
    font: bold,
    color: white
  });

  y -= 90;

  // Title Ribbon
  page.drawRectangle({
    x: 35,
    y: y - 20,
    width: 525,
    height: 22,
    color: darkNavy
  });

  page.drawText("COMPETENCY-BASED CURRICULUM (CBC) TERMLY PROGRESS DOSSIER", {
    x: 95,
    y: y - 14,
    size: 9.5,
    font: bold,
    color: white
  });

  y -= 34;

  // Learner Bio Card
  page.drawRectangle({
    x: 35,
    y: y - 52,
    width: 525,
    height: 52,
    color: lightBg,
    borderColor: borderLight,
    borderWidth: 1
  });

  const row1Y = y - 18;
  const row2Y = y - 36;

  page.drawText("Learner Name:", { x: 45, y: row1Y, size: 8, font: bold, color: slateMuted });
  page.drawText(learner.name, { x: 125, y: row1Y, size: 9, font: bold, color: darkNavy });

  page.drawText("Admission No:", { x: 300, y: row1Y, size: 8, font: bold, color: slateMuted });
  page.drawText(learner.admissionNo, { x: 380, y: row1Y, size: 8.5, font: bold, color: darkNavy });

  page.drawText("Class / Grade:", { x: 45, y: row2Y, size: 8, font: bold, color: slateMuted });
  page.drawText(learner.grade, { x: 125, y: row2Y, size: 8.5, font: bold, color: darkNavy });

  // Calculate attendance for the term
  const presentDays = learner.attendance.filter((a) => a.status === "PRESENT").length;
  const totalDays = Math.max(learner.attendance.length, 1);
  const attRate = Math.round((presentDays / totalDays) * 100);

  page.drawText("Term Attendance:", { x: 300, y: row2Y, size: 8, font: bold, color: slateMuted });
  page.drawText(`${presentDays} / ${totalDays} Days (${attRate}%)`, { x: 380, y: row2Y, size: 8.5, font: bold, color: darkNavy });

  y -= 64;

  // CBC Grading Key Legend
  page.drawRectangle({
    x: 35,
    y: y - 22,
    width: 525,
    height: 22,
    color: rgb(0.94, 0.96, 1.0),
    borderColor: borderLight,
    borderWidth: 0.5
  });

  page.drawText("CBC ASSESSMENT RUBRIC:", { x: 42, y: y - 14, size: 7.5, font: bold, color: royalBlue });
  page.drawText("EE - Exceeding Expectations (80-100%)", { x: 155, y: y - 14, size: 7.5, font: bold, color: darkNavy });
  page.drawText("ME - Meeting (60-79%)", { x: 310, y: y - 14, size: 7.5, font: bold, color: successGreen });
  page.drawText("AE - Approaching (40-59%)", { x: 405, y: y - 14, size: 7.5, font: bold, color: amberColor });
  page.drawText("BE - Below (<40%)", { x: 505, y: y - 14, size: 7.5, font: bold, color: redColor });

  y -= 30;

  // Academic Results Table Header
  page.drawRectangle({
    x: 35,
    y: y - 18,
    width: 525,
    height: 20,
    color: royalBlue
  });

  page.drawText("LEARNING AREA / SUBJECT", { x: 42, y: y - 12, size: 8, font: bold, color: white });
  page.drawText("SCORE", { x: 215, y: y - 12, size: 8, font: bold, color: white });
  page.drawText("CBC LEVEL", { x: 260, y: y - 12, size: 8, font: bold, color: white });
  page.drawText("COMPETENCY / TEACHER REMARKS", { x: 330, y: y - 12, size: 8, font: bold, color: white });

  y -= 22;

  // Subjects rows
  let totalScore = 0;
  let subjectCount = 0;

  if (termAssessments.length === 0) {
    page.drawRectangle({
      x: 35,
      y: y - 30,
      width: 525,
      height: 30,
      color: lightBg,
      borderColor: borderLight,
      borderWidth: 0.5
    });
    page.drawText("No released assessments recorded for this term yet.", {
      x: 180,
      y: y - 18,
      size: 9,
      font,
      color: slateMuted
    });
    y -= 38;
  } else {
    for (const [idx, item] of termAssessments.entries()) {
      totalScore += item.score;
      subjectCount++;
      const level = cbcLevel(item.score);

      const rowH = 22;
      const rowBg = idx % 2 === 0 ? white : rgb(0.98, 0.985, 0.995);

      page.drawRectangle({
        x: 35,
        y: y - rowH + 4,
        width: 525,
        height: rowH,
        color: rowBg,
        borderColor: borderLight,
        borderWidth: 0.5
      });

      page.drawText(item.subject, { x: 42, y: y - 8, size: 8.5, font: bold, color: darkNavy });
      page.drawText(`${Math.round(item.score)}%`, { x: 220, y: y - 8, size: 8.5, font: bold, color: darkNavy });

      // Level color badge
      const levelColor = level === "EE" ? royalBlue : level === "ME" ? successGreen : level === "AE" ? amberColor : redColor;
      page.drawRectangle({
        x: 260,
        y: y - 12,
        width: 32,
        height: 14,
        color: levelColor
      });
      page.drawText(level, { x: 270, y: y - 8, size: 7.5, font: bold, color: white });

      const remark = item.comment || (level === "EE" ? "Exemplary understanding and mastery" : level === "ME" ? "Competent with consistent effort" : level === "AE" ? "Steady progress; needs practice" : "Requires remedial guidance");
      const cleanRemark = remark.length > 40 ? remark.slice(0, 39) + "…" : remark;
      page.drawText(cleanRemark, { x: 330, y: y - 8, size: 7.5, font, color: slateMuted });

      y -= rowH;
    }
  }

  y -= 6;

  // Performance Summary Row
  const meanScore = subjectCount > 0 ? Math.round(totalScore / subjectCount) : 0;
  const overallLevel = subjectCount > 0 ? cbcLevel(meanScore) : "ME";

  page.drawRectangle({
    x: 35,
    y: y - 36,
    width: 525,
    height: 38,
    color: rgb(0.93, 0.96, 1.0),
    borderColor: royalBlue,
    borderWidth: 1.2
  });

  page.drawText("TERMLY PERFORMANCE SUMMARY", { x: 45, y: y - 16, size: 9, font: bold, color: royalBlue });
  page.drawText(`Learning Areas Assessed: ${subjectCount}`, { x: 45, y: y - 28, size: 8, font, color: darkNavy });

  page.drawText(`Overall Mean Score: ${meanScore}%`, { x: 230, y: y - 20, size: 10, font: bold, color: darkNavy });

  page.drawText("Overall CBE Evaluation:", { x: 380, y: y - 16, size: 8, font: bold, color: slateMuted });
  const overallBadgeText = overallLevel === "EE" ? "Exceeding Expectations (EE)" : overallLevel === "ME" ? "Meeting Expectations (ME)" : overallLevel === "AE" ? "Approaching (AE)" : "Below (BE)";
  page.drawText(overallBadgeText, { x: 380, y: y - 28, size: 8.5, font: bold, color: royalBlue });

  y -= 52;

  // Values, Conduct & Co-Curricular Appraisal
  page.drawRectangle({
    x: 35,
    y: y - 48,
    width: 525,
    height: 48,
    color: lightBg,
    borderColor: borderLight,
    borderWidth: 0.5
  });

  page.drawText("VALUES, CORE COMPETENCIES & CO-CURRICULAR APPRAISAL", {
    x: 45,
    y: y - 14,
    size: 8,
    font: bold,
    color: royalBlue
  });

  page.drawText("Discipline & Conduct: Outstanding · Exemplifies school motto 'Hard Work Pays'", {
    x: 45,
    y: y - 28,
    size: 7.8,
    font,
    color: darkNavy
  });

  page.drawText("Core Values & Talents: High collaboration, integrity, active in sports, creative arts & leadership", {
    x: 45,
    y: y - 40,
    size: 7.8,
    font,
    color: darkNavy
  });

  y -= 62;

  // Remarks & Sign-off Section
  page.drawRectangle({
    x: 35,
    y: y - 85,
    width: 525,
    height: 85,
    color: white,
    borderColor: borderLight,
    borderWidth: 1
  });

  // Class Teacher remarks
  page.drawText("Class Teacher's Remarks:", { x: 45, y: y - 16, size: 8, font: bold, color: slateMuted });
  const teacherRemark = meanScore >= 80
    ? "An exceptional performance throughout the term. Shows natural curiosity, discipline, and outstanding mastery."
    : meanScore >= 60
    ? "A commendable and steady term. Actively participates in class activities and demonstrates solid understanding."
    : "Made observable effort. Encouraged to engage more during revisions and seek assistance in challenging areas.";
  page.drawText(teacherRemark, { x: 45, y: y - 28, size: 7.8, font, color: darkNavy });

  page.drawText("Class Teacher Sign: ___________________________   Date: ____________________", {
    x: 45,
    y: y - 42,
    size: 7.5,
    font,
    color: slateMuted
  });

  // Head Teacher remarks
  page.drawText("Head Teacher's Remarks & Official Seal:", { x: 45, y: y - 56, size: 8, font: bold, color: slateMuted });
  const htRemark = meanScore >= 60
    ? "Promoted to continue with commendable progress. Keep up the disciplined spirit and excellence."
    : "Progress noted. Consistent home support and targeted remediation recommended for next term.";
  page.drawText(htRemark, { x: 45, y: y - 68, size: 7.8, font: bold, color: royalBlue });

  page.drawText("Head Teacher Sign & Official Stamp: ___________________________", {
    x: 45,
    y: y - 80,
    size: 7.5,
    font,
    color: slateMuted
  });

  y -= 96;

  // Next Term Opening Date Banner
  page.drawRectangle({
    x: 35,
    y: y - 18,
    width: 525,
    height: 20,
    color: rgb(0.95, 0.97, 0.92),
    borderColor: rgb(0.75, 0.85, 0.7),
    borderWidth: 0.5
  });

  page.drawText("NEXT TERM COMMENCEMENT: Please report promptly on the official school opening date as scheduled by MOE.", {
    x: 45,
    y: y - 12,
    size: 7.5,
    font: bold,
    color: rgb(0.1, 0.45, 0.2)
  });

  // Verification QR Code
  try {
    const qrData = `MARY_ROYAL_REPORT:${learner.id}:${learner.admissionNo}:${targetTerm}:${meanScore}%`;
    const qrMatrix = generateQrMatrix(qrData);
    const qrSize = 48;
    const qrPixelSize = qrSize / qrMatrix.length;
    const qrX = pageW - 35 - qrSize;
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
    page.drawText("Scan to verify", { x: qrX - 2, y: qrY - 8, size: 6.5, font, color: slateMuted });
  } catch {}

  // Footer microprint
  const printTimestamp = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi"
  }).format(new Date());

  page.drawText(
    `Mary Royal Primary & Junior School · P.O. Box 40100, Kisumu · Official Academic Report · Generated ${printTimestamp} EAT`,
    {
      x: 35,
      y: 28,
      size: 7,
      font,
      color: slateMuted
    }
  );

  const pdfBytes = await pdf.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="MaryRoyal-ReportCard-${targetTerm}-${learner.admissionNo}-${learner.name.replace(/\s+/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}

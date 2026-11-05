import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { generateQrMatrix } from "@/lib/qr";

function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

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

  // Authorization check
  const schoolScope = canInScope(user.role, "learners", "view", "school");
  const linkedScope = canInScope(user.role, "learners", "view", "linked");
  const ownScope = canInScope(user.role, "learners", "view", "self");

  const learner = await db.learner.findUnique({
    where: { id },
    include: {
      profile: true,
      admissionDraft: true,
      guardians: {
        include: {
          user: { select: { id: true, name: true, phone: true, email: true } }
        }
      }
    }
  });

  if (!learner) return NextResponse.json({ error: "Learner not found." }, { status: 404 });

  if (!schoolScope) {
    if (linkedScope) {
      const isLinked = learner.guardians.some((g) => g.userId === user.id);
      if (!isLinked) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (ownScope) {
      // Learner user viewing their own record
      const isSelf = user.email.toLowerCase() === `${learner.admissionNo.toLowerCase()}@maryroyal.ac.ke`;
      if (!isSelf) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Parse draft data if available for extra contact info
  let draftData: any = {};
  if (learner.admissionDraft?.payload) {
    try {
      draftData = JSON.parse(learner.admissionDraft.payload);
    } catch {
      draftData = {};
    }
  }

  // Palette
  const royalBlue = rgb(0.114, 0.306, 0.847);
  const darkNavy = rgb(0.063, 0.137, 0.247);
  const goldAccent = rgb(0.85, 0.65, 0.13);
  const slateMuted = rgb(0.39, 0.45, 0.53);
  const lightBg = rgb(0.96, 0.975, 0.995);
  const borderLight = rgb(0.86, 0.89, 0.94);
  const white = rgb(1, 1, 1);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Admission Slip - ${learner.name} (${learner.admissionNo})`);
  pdf.setAuthor("Mary Royal Primary & Junior School · Obunga, Kisumu");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const [pageW, pageH] = [595.28, 841.89];

  // Certificate Decorative Double Border
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

  // Top right Admission Badge
  page.drawRectangle({
    x: 430,
    y: y - 66,
    width: 122,
    height: 56,
    color: royalBlue
  });

  page.drawText("ADMISSION SLIP", {
    x: 440,
    y: y - 26,
    size: 7.5,
    font: bold,
    color: goldAccent
  });

  page.drawText(learner.admissionNo, {
    x: 440,
    y: y - 44,
    size: 12,
    font: bold,
    color: white
  });

  page.drawText("STATUS: ENROLLED", {
    x: 440,
    y: y - 58,
    size: 7,
    font: bold,
    color: white
  });

  y -= 90;

  // Title Banner
  page.drawRectangle({
    x: 35,
    y: y - 22,
    width: 525,
    height: 24,
    color: darkNavy
  });

  page.drawText("OFFICIAL CERTIFICATE OF ADMISSION & ENROLMENT", {
    x: 125,
    y: y - 15,
    size: 10,
    font: bold,
    color: white
  });

  y -= 40;

  const section = (title: string) => {
    y -= 4;
    page.drawRectangle({
      x: 35,
      y: y - 5,
      width: 525,
      height: 19,
      color: lightBg,
      borderColor: borderLight,
      borderWidth: 0.5
    });
    page.drawRectangle({
      x: 35,
      y: y - 5,
      width: 4,
      height: 19,
      color: royalBlue
    });
    page.drawText(title.toUpperCase(), { x: 46, y: y + 1, size: 8.5, font: bold, color: royalBlue });
    y -= 22;
  };

  const drawRow = (label1: string, val1: string, label2?: string, val2?: string) => {
    page.drawText(label1 + ":", { x: 45, y, size: 8.5, font: bold, color: slateMuted });
    const clean1 = val1 || "Not recorded";
    page.drawText(clean1.length > 30 ? clean1.slice(0, 29) + "…" : clean1, { x: 145, y, size: 8.5, font, color: darkNavy });

    if (label2) {
      page.drawText(label2 + ":", { x: 310, y, size: 8.5, font: bold, color: slateMuted });
      const clean2 = val2 || "Not recorded";
      page.drawText(clean2.length > 30 ? clean2.slice(0, 29) + "…" : clean2, { x: 410, y, size: 8.5, font, color: darkNavy });
    }
    y -= 16;
  };

  // Section 1: Learner Details
  section("1. Learner Profile & Enrolment Information");
  drawRow("Full Legal Name", learner.name, "Admission Number", learner.admissionNo);
  drawRow("Class / Grade", learner.grade, "Gender", learner.gender);
  drawRow("UPI / NEMIS No", draftData.learner?.upiNumber || "Pending MOE UPI", "Nationality", "Kenyan");
  const approvedDateStr = learner.admissionApprovedAt
    ? new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(learner.admissionApprovedAt)
    : "Current Session";
  drawRow("Enrolment Date", approvedDateStr, "Curriculum Track", "Competency Based (CBC)");

  y -= 8;

  // Section 2: Residential & Contact Details
  section("2. Residence & Transport Roster");
  drawRow("County", "Kisumu County", "Sub-County", "Kisumu Central");
  drawRow("Ward / Locality", "Railways / Obunga", "Physical Residence", draftData.residence?.physicalAddress || "Obunga, Near Breweries");
  drawRow("Commute Mode", draftData.residence?.transportMeans || "Day Scholar / Walking", "Emergency Contact", draftData.emergencyContacts?.[0]?.phone || "School Office");

  y -= 8;

  // Section 3: Parent & Legal Guardian Details
  section("3. Registered Parents & Legal Guardians");
  if (learner.guardians && learner.guardians.length > 0) {
    for (const [idx, g] of learner.guardians.entries()) {
      drawRow(`Guardian #${idx + 1}`, g.user.name, "Relationship", g.relation || "Parent / Guardian");
      drawRow("Contact Telephone", g.user.phone || "On file", "Email Address", g.user.email || "On file");
    }
  } else if (draftData.guardians && draftData.guardians.length > 0) {
    for (const [idx, g] of draftData.guardians.entries()) {
      drawRow(`Guardian #${idx + 1}`, g.fullName || "Guardian", "Relationship", g.relationship || "Parent / Guardian");
      drawRow("Contact Telephone", g.phone || "On file", "National ID", g.idNumber || "On file");
    }
  } else {
    drawRow("Parent / Guardian", "Registered in Primary Dossier", "Contact Status", "Active on Portal");
  }

  y -= 8;

  // Section 4: Institution Undertaking & Enrolment Terms
  section("4. School Rules, Curriculum Undertaking & Terms of Admission");
  const termsText = [
    "1. The learner is admitted to Mary Royal Primary & Junior School subject to compliance with the school code of conduct.",
    "2. Learning area progress and core competencies will be continuously assessed under Kenya CBC / KNEC guidelines.",
    "3. Tuition fees and associated school levies are payable on or before the opening day of each academic term.",
    "4. Personal data is safeguarded strictly under the Kenya Data Protection Act 2019 and school data governance rules."
  ];

  for (const t of termsText) {
    page.drawText(t, { x: 45, y, size: 7.8, font, color: darkNavy });
    y -= 13;
  }

  y -= 10;

  // Section 5: Official Signatures & Seal
  section("5. Institutional Endorsements & Official Seal");
  y -= 10;

  const col1 = 45;
  const col2 = 225;
  const col3 = 405;

  page.drawText("Parent / Guardian Signature:", { x: col1, y, size: 7.5, font: bold, color: slateMuted });
  page.drawText("Admissions Secretary Stamp:", { x: col2, y, size: 7.5, font: bold, color: slateMuted });
  page.drawText("Head Teacher / Director:", { x: col3, y, size: 7.5, font: bold, color: slateMuted });

  y -= 30;
  page.drawLine({ start: { x: col1, y }, end: { x: col1 + 140, y }, thickness: 0.5, color: darkNavy });
  page.drawLine({ start: { x: col2, y }, end: { x: col2 + 140, y }, thickness: 0.5, color: darkNavy });
  page.drawLine({ start: { x: col3, y }, end: { x: col3 + 140, y }, thickness: 0.5, color: darkNavy });

  y -= 12;
  page.drawText("Signature & Date", { x: col1, y, size: 7, font, color: slateMuted });
  page.drawText("Verified & Entered", { x: col2, y, size: 7, font, color: slateMuted });
  page.drawText("Official School Seal & Sign", { x: col3, y, size: 7, font, color: slateMuted });

  // Verification QR Code
  try {
    const qrData = `MARY_ROYAL_ENROLLED:${learner.id}:${learner.admissionNo}:${learner.name}:${learner.grade}`;
    const qrMatrix = generateQrMatrix(qrData);
    const qrSize = 50;
    const qrPixelSize = qrSize / qrMatrix.length;
    const qrX = pageW - 35 - qrSize;
    const qrY = 35;

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
    `Mary Royal Primary & Junior School · P.O. Box 40100, Kisumu · Official Enrolment Document · Generated ${printTimestamp} EAT`,
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
      "Content-Disposition": `inline; filename="MaryRoyal-AdmissionSlip-${learner.admissionNo}-${learner.name.replace(/\s+/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store"
    }
  });
}

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { assertCanInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { admissionDocumentCategoryLabels, admissionDraftDataSchema } from "@/lib/admissions";
import { readStoredFile } from "@/lib/file-storage";
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

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!user || user.suspended || user.forcePasswordChange) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    assertCanInScope(user.role, "admissions", "view", "school");
  } catch {
    await db.auditEvent.create({
      data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDraft" }
    });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const draft = await db.admissionDraft.findUnique({
    where: { id },
    include: {
      documents: { select: { category: true, storageKey: true, contentType: true } },
      learner: { select: { id: true, admissionApprovedAt: true } }
    }
  });

  if (!draft) return NextResponse.json({ error: "Admission form not found." }, { status: 404 });

  let raw: unknown;
  try {
    raw = JSON.parse(draft.payload) as unknown;
  } catch {
    raw = {};
  }
  const parsed = admissionDraftDataSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : {};

  // Color Palette
  const royalBlue = rgb(0.114, 0.306, 0.847); // #1D4ED8
  const darkNavy = rgb(0.063, 0.137, 0.247);  // #10233F
  const goldAccent = rgb(0.85, 0.65, 0.13); // #D9A521
  const slateMuted = rgb(0.39, 0.45, 0.53);
  const lightBg = rgb(0.96, 0.975, 0.995);
  const borderLight = rgb(0.86, 0.89, 0.94);
  const white = rgb(1, 1, 1);
  const successGreen = rgb(0.06, 0.52, 0.25);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Official Admission Dossier - ${draft.admissionNo} · Mary Royal School`);
  pdf.setAuthor("Mary Royal Primary & Junior School · Obunga, Kisumu");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89]; // A4
  const [pageW, pageH] = pageSize;

  let page!: PDFPage;
  let pageIndex = 0;
  let y = 0;

  const drawPageBorder = (p: PDFPage) => {
    // Outer decorative border
    p.drawRectangle({
      x: 20,
      y: 20,
      width: pageW - 40,
      height: pageH - 40,
      borderColor: royalBlue,
      borderWidth: 1.5
    });
    // Inner fine border
    p.drawRectangle({
      x: 24,
      y: 24,
      width: pageW - 48,
      height: pageH - 48,
      borderColor: goldAccent,
      borderWidth: 0.5
    });
  };

  const newPage = () => {
    page = pdf.addPage(pageSize);
    pageIndex++;
    drawPageBorder(page);
    y = 795;
  };

  const ensure = (height: number) => {
    if (y - height < 55) {
      newPage();
      drawSubHeader();
    }
  };

  const drawSubHeader = () => {
    page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL · ADMISSION DOSSIER", {
      x: 35,
      y: y,
      size: 8,
      font: bold,
      color: royalBlue
    });
    page.drawText(`ADMISSION NO: ${draft.admissionNo} · Page ${pageIndex}`, {
      x: pageW - 200,
      y: y,
      size: 8,
      font,
      color: slateMuted
    });
    y -= 8;
    page.drawLine({
      start: { x: 35, y },
      end: { x: pageW - 35, y },
      thickness: 0.5,
      color: borderLight
    });
    y -= 16;
  };

  const line = (text: string, size = 8.5, color = darkNavy, strong = false) => {
    const selected = strong ? bold : font;
    const lines = wrap(text || "Not provided", selected, size, 510);
    ensure(lines.length * (size + 4) + 4);
    for (const item of lines) {
      page.drawText(item, { x: 40, y, size, font: selected, color });
      y -= size + 4;
    }
  };

  const drawGridRow = (label1: string, val1: string, label2?: string, val2?: string) => {
    ensure(18);
    // Left column
    page.drawText(label1 + ":", { x: 40, y, size: 8, font: bold, color: slateMuted });
    const cleanVal1 = val1 || "Not provided";
    page.drawText(cleanVal1.length > 34 ? cleanVal1.slice(0, 33) + "…" : cleanVal1, {
      x: 135,
      y,
      size: 8,
      font,
      color: darkNavy
    });

    if (label2) {
      // Right column
      page.drawText(label2 + ":", { x: 300, y, size: 8, font: bold, color: slateMuted });
      const cleanVal2 = val2 || "Not provided";
      page.drawText(cleanVal2.length > 34 ? cleanVal2.slice(0, 33) + "…" : cleanVal2, {
        x: 395,
        y,
        size: 8,
        font,
        color: darkNavy
      });
    }
    y -= 14;
  };

  const section = (title: string) => {
    ensure(36);
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
    // Blue accent bar on the left
    page.drawRectangle({
      x: 35,
      y: y - 5,
      width: 4,
      height: 19,
      color: royalBlue
    });
    page.drawText(title.toUpperCase(), { x: 46, y: y + 1, size: 8.5, font: bold, color: royalBlue });
    y -= 20;
  };

  // PAGE 1 INITIALIZATION
  newPage();

  // Header Box
  page.drawRectangle({
    x: 35,
    y: 715,
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
    page.drawImage(image, { x: 45, y: 721, width: 60, height: 60 });
    textStartX = 114;
  } catch {
    /* Fallback if logo file unavailable */
  }

  // Official Institutional Masthead with Verified P.O. Box & Contact
  page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", {
    x: textStartX,
    y: 766,
    size: 15,
    font: bold,
    color: darkNavy
  });

  page.drawText("P.O. Box 40100, Kisumu, Kenya · Tel: +254 718 216 374 · Email: maryroyalschool81@gmail.com", {
    x: textStartX,
    y: 751,
    size: 7.8,
    font,
    color: slateMuted
  });

  page.drawText("Physical Location: Obunga (Near Breweries), Kisumu, Kenya · MOE / CBE Reg.", {
    x: textStartX,
    y: 739,
    size: 7.5,
    font,
    color: slateMuted
  });

  page.drawText("Motto: \"Hard Work Pays\"  ·  Slogan: \"Nurturing Excellence Through CBE\"", {
    x: textStartX,
    y: 727,
    size: 7.5,
    font: bold,
    color: royalBlue
  });

  // Top right Admission Badge
  page.drawRectangle({
    x: 430,
    y: 723,
    width: 122,
    height: 56,
    color: royalBlue
  });

  page.drawText("OFFICIAL ADMISSION", {
    x: 440,
    y: 764,
    size: 7.5,
    font: bold,
    color: goldAccent
  });

  page.drawText(draft.admissionNo, {
    x: 440,
    y: 746,
    size: 12,
    font: bold,
    color: white
  });

  const statusLabel = draft.status === "ENROLLED" ? "STATUS: ENROLLED" : `STATUS: ${draft.status}`;
  page.drawText(statusLabel, {
    x: 440,
    y: 732,
    size: 7.5,
    font: bold,
    color: white
  });

  // Document Title Ribbon
  y = 698;
  page.drawRectangle({
    x: 35,
    y: y - 16,
    width: 525,
    height: 22,
    color: darkNavy
  });

  page.drawText("OFFICIAL LEARNER ADMISSION & CBE ENROLMENT DOSSIER", {
    x: 105,
    y: y - 10,
    size: 9.5,
    font: bold,
    color: white
  });

  y -= 30;

  const learner = data.learner;
  section("1. Learner Personal Details & Identification");
  drawGridRow("Full Legal Name", String(learner?.fullName || ""), "UPI / NEMIS No", String(learner?.upiNumber || ""));
  drawGridRow("Date of Birth", String(learner?.dateOfBirth || ""), "Gender", String(learner?.gender || ""));
  drawGridRow("Class / Grade Applied", String(learner?.grade || ""), "Stream Allocated", String(learner?.stream || "Main Stream"));
  drawGridRow("Nationality", String(learner?.nationality || "Kenyan"), "Religion", String(learner?.religion || "Christian"));
  drawGridRow("Admission Date", String(learner?.admissionDate || ""), "Previous School", String(learner?.previousSchool || "N/A"));
  if (learner?.reasonForLeaving) line(`Reason for Leaving Previous School: ${learner.reasonForLeaving}`, 7.5, slateMuted);

  section("2. Residence, Location & Commute Details");
  const residence = data.residence;
  drawGridRow("County", String(residence?.county || "Kisumu"), "Sub-County", String(residence?.subCounty || "Kisumu Central"));
  drawGridRow("Ward", String(residence?.ward || "Railways / Obunga"), "Village / Estate", String(residence?.village || "Obunga"));
  drawGridRow("Physical Address", String(residence?.physicalAddress || "Near Breweries"), "Nearest Landmark", String(residence?.landmark || ""));
  drawGridRow("Distance to School", residence?.distanceToSchoolKm ? `${residence.distanceToSchoolKm} km` : "Within locality", "Means of Commute", String(residence?.transportMeans || "Walking / Foot"));

  section("3. Parents & Legal Guardians Information");
  for (const [index, guardian] of (data.guardians ?? []).entries()) {
    line(`${index + 1}. ${guardian.fullName || "Guardian"} · ${guardian.relationship || "Guardian"}${guardian.primaryContact ? " [Primary Contact]" : ""}${guardian.paysFees ? " [Fee Payer]" : ""}`, 8.5, royalBlue, true);
    drawGridRow("Mobile Phone", String(guardian.phone || ""), "Email Address", String(guardian.email || ""));
    drawGridRow("National ID / Passport", String(guardian.idNumber || ""), "Occupation / Employer", [guardian.occupation, guardian.employer].filter(Boolean).join(" · ") || "Private");
    if (guardian.homeAddress) line(`Residential Address: ${guardian.homeAddress}`, 7.5, slateMuted);
  }

  section("4. Emergency Contacts & Authorized Pick-up Roster");
  for (const [index, contact] of (data.emergencyContacts ?? []).entries()) {
    drawGridRow(`Emergency #${index + 1}`, `${contact.fullName || "Not provided"} (${contact.relationship || "Contact"})`, "Phone", String(contact.phone || ""));
  }
  for (const [index, person] of (data.pickupPersons ?? []).entries()) {
    drawGridRow(`Authorized Pick-up #${index + 1}`, `${person.fullName || "Not provided"} (${person.relationship || "Collector"})`, "Phone", String(person.phone || ""));
  }

  section("5. Health, Wellbeing & Medical Declaration (Confidential)");
  const health = data.health;
  drawGridRow("Blood Group", String(health?.bloodGroup || "Not recorded"), "Immunization Status", String(health?.immunizationStatus || "Fully Immunized (KEPI)"));
  drawGridRow("Preferred Hospital", String(health?.doctorOrHospital || "Kisumu County Referral Hospital"), "Health Insurance / SHA", String(health?.healthInsurance || "SHA / NHIF"));
  if (health?.knownConditions) line(`Known Medical Conditions: ${health.knownConditions}`, 8, darkNavy, true);
  if (health?.allergies) line(`Allergies (Food / Drug / Environmental): ${health.allergies}`, 8, darkNavy, true);
  if (health?.currentMedication) line(`Medication in use: ${health.currentMedication}`, 8, darkNavy);
  if (health?.specialNeeds) line(`Special Educational / Learning Needs: ${health.specialNeeds}`, 8, darkNavy);

  section("6. Fee Hand-Off & Administrative Terms");
  drawGridRow("Admission Term", String(data.fee?.term || "Term 1"), "Fee Payer Responsible", String(data.fee?.feePayerGuardian || "Parent / Guardian"));
  drawGridRow("Optional School Services", (data.fee?.requestedOptionalItems ?? []).join(", ") || "Standard CBE Tuition & Lunch", "Data Protection Consent", data.consent ? "Granted (Kenya Data Protection Act 2019)" : "Granted");
  if (data.fee?.handoffNote) line(`Bursar / Accountant Memo: ${data.fee.handoffNote}`, 7.5, slateMuted);

  section("7. Verified Documents Checklist");
  for (const [category, label] of Object.entries(admissionDocumentCategoryLabels)) {
    const uploaded = draft.documents.some(document => document.category === category);
    line(`${uploaded ? "[X]" : "[ ]"} ${label}${category === "PASSPORT_PHOTO" || category === "BIRTH_CERTIFICATE" ? " (Mandatory)" : ""}`, 7.5, uploaded ? successGreen : slateMuted);
  }

  // Learner Passport Photo if attached
  const photo = draft.documents.find(document => document.category === "PASSPORT_PHOTO");
  if (photo && photo.contentType !== "application/pdf" && /^[a-f0-9-]{36}\.(jpg|png)$/.test(photo.storageKey)) {
    try {
      const bytes = await readStoredFile("private", `admissions/${id}/${photo.storageKey}`);
      const image = photo.contentType === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      ensure(115);
      const photoY = y - 98;
      page.drawImage(image, { x: 450, y: photoY, width: 75, height: 90, opacity: 0.98 });
      page.drawRectangle({ x: 450, y: photoY, width: 75, height: 90, borderColor: royalBlue, borderWidth: 1 });
      page.drawText("STUDENT PHOTO", { x: 455, y: photoY - 10, size: 6.5, font: bold, color: slateMuted });
      y -= 108;
    } catch {
      /* Keep document clean if image corrupt */
    }
  }

  // Formal Institutional Sign-off Block
  ensure(90);
  y -= 8;
  page.drawText("INSTITUTIONAL DECLARATION & FORMAL ENDORSEMENTS", {
    x: 40,
    y,
    size: 8.5,
    font: bold,
    color: darkNavy
  });
  y -= 6;
  page.drawLine({ start: { x: 35, y }, end: { x: pageW - 35, y }, thickness: 0.5, color: borderLight });
  y -= 18;

  const sigCol1 = 45;
  const sigCol2 = 225;
  const sigCol3 = 405;

  page.drawText("Parent / Legal Guardian:", { x: sigCol1, y, size: 7.5, font: bold, color: slateMuted });
  page.drawText("Admissions Secretary:", { x: sigCol2, y, size: 7.5, font: bold, color: slateMuted });
  page.drawText("Head Teacher / Director:", { x: sigCol3, y, size: 7.5, font: bold, color: slateMuted });

  y -= 26;
  page.drawLine({ start: { x: sigCol1, y }, end: { x: sigCol1 + 140, y }, thickness: 0.5, color: darkNavy });
  page.drawLine({ start: { x: sigCol2, y }, end: { x: sigCol2 + 140, y }, thickness: 0.5, color: darkNavy });
  page.drawLine({ start: { x: sigCol3, y }, end: { x: sigCol3 + 140, y }, thickness: 0.5, color: darkNavy });

  y -= 10;
  page.drawText("Signature & Date", { x: sigCol1, y, size: 7, font, color: slateMuted });
  page.drawText("Verified & Stamped", { x: sigCol2, y, size: 7, font, color: slateMuted });
  page.drawText("Approved with Official Seal", { x: sigCol3, y, size: 7, font, color: slateMuted });

  // Verification QR code
  try {
    const qrData = `MARY_ROYAL_ADMISSION:${draft.id}:${draft.admissionNo}:${learner?.fullName || "Learner"}:${draft.status}`;
    const qrMatrix = generateQrMatrix(qrData);
    const qrSize = 50;
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
  } catch {
    /* QR optional */
  }

  // Bottom microprint on every page
  const totalPages = pdf.getPageCount();
  const printTimestamp = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi"
  }).format(new Date());

  for (let i = 0; i < totalPages; i++) {
    const p = pdf.getPage(i);
    p.drawText(
      `Mary Royal Primary & Junior School · P.O. Box 40100, Kisumu · Official Enrolment Document · Generated ${printTimestamp} EAT · Page ${i + 1} of ${totalPages}`,
      {
        x: 35,
        y: 28,
        size: 7,
        font,
        color: slateMuted
      }
    );
  }

  await db.auditEvent.create({
    data: { actorId: user.id, action: "ADMISSION_FORM_EXPORTED", entity: "AdmissionDraft", entityId: id }
  });

  const bytes = await pdf.save();
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const inline = new URL(request.url).searchParams.get("download") === "0";
  return new NextResponse(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="Mary-Royal-Admission-${draft.admissionNo}.pdf"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

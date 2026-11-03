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


function wrap(value: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of value.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) { lines.push(line); line = word; } else line = candidate;
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get("mary_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  const user = await db.user.findUnique({ where: { id: session.id }, select: { id: true, role: true, suspended: true, forcePasswordChange: true } });
  if (!user || user.suspended || user.forcePasswordChange) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  try { assertCanInScope(user.role, "admissions", "view", "school"); } catch { await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "AdmissionDraft" } }); return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const { id } = await params;
  const draft = await db.admissionDraft.findUnique({ where: { id }, include: { documents: { select: { category: true, storageKey: true, contentType: true } }, learner: { select: { id: true, admissionApprovedAt: true } } } });
  if (!draft) return NextResponse.json({ error: "Admission form not found." }, { status: 404 });
  let raw: unknown;
  try { raw = JSON.parse(draft.payload) as unknown; } catch { raw = {}; }
  const parsed = admissionDraftDataSchema.safeParse(raw);
  const data = parsed.success ? parsed.data : {};
  const blue = rgb(0.114, 0.306, 0.847);
  const darkBlue = rgb(0.07, 0.18, 0.45);
  const navy = rgb(0.055, 0.114, 0.224);
  const muted = rgb(0.38, 0.44, 0.52);
  const lightBg = rgb(0.94, 0.96, 0.99);
  const borderLight = rgb(0.85, 0.89, 0.95);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Admission form ${draft.admissionNo} · Mary Royal School`);
  pdf.setAuthor("Mary Royal School · Obunga, Kisumu");
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [595.28, 841.89];
  let page!: PDFPage;
  let y = 0;
  const newPage = () => { page = pdf.addPage(pageSize); y = 792; };
  const ensure = (height: number) => { if (y - height < 58) newPage(); };

  const line = (text: string, size = 9, color = navy, strong = false) => {
    const selected = strong ? bold : font;
    const lines = wrap(text || "Not provided", selected, size, 500);
    ensure(lines.length * (size + 4) + 4);
    for (const item of lines) { page.drawText(item, { x: 48, y, size, font: selected, color }); y -= size + 4; }
  };

  const drawGridRow = (label1: string, val1: string, label2?: string, val2?: string) => {
    ensure(20);
    // Left column: x = 48, label width ~90, value at 145
    page.drawText(label1 + ":", { x: 48, y, size: 8.5, font: bold, color: muted });
    const cleanVal1 = val1 || "Not provided";
    page.drawText(cleanVal1.length > 32 ? cleanVal1.slice(0, 31) + "…" : cleanVal1, { x: 142, y, size: 8.5, font, color: navy });

    if (label2) {
      // Right column: x = 300, label width ~90, value at 395
      page.drawText(label2 + ":", { x: 300, y, size: 8.5, font: bold, color: muted });
      const cleanVal2 = val2 || "Not provided";
      page.drawText(cleanVal2.length > 32 ? cleanVal2.slice(0, 31) + "…" : cleanVal2, { x: 400, y, size: 8.5, font, color: navy });
    }
    y -= 14;
  };

  const section = (title: string) => {
    ensure(36);
    y -= 4;
    page.drawRectangle({ x: 42, y: y - 5, width: 511, height: 20, color: lightBg, borderColor: borderLight, borderWidth: 0.5 });
    page.drawText(title.toUpperCase(), { x: 50, y, size: 8.5, font: bold, color: darkBlue });
    y -= 22;
  };

  newPage();
  try {
    const logo = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
    const image = await pdf.embedPng(logo);
    page.drawImage(image, { x: 46, y: 738, width: 62, height: 62 });
  } catch { /* The text masthead remains printable if the optional logo file is unavailable. */ }

  page.drawText("MARY ROYAL SCHOOL", { x: 120, y: 780, size: 18, font: bold, color: darkBlue });
  page.drawText("Obunga, Kisumu, Kenya · Motto: Hard work pays", { x: 120, y: 764, size: 9.5, font, color: muted });
  page.drawText("OFFICIAL LEARNER ADMISSION & CBE DOSSIER", { x: 120, y: 748, size: 9.5, font: bold, color: blue });

  // Top right metadata box
  page.drawRectangle({ x: 395, y: 738, width: 156, height: 50, color: lightBg, borderColor: borderLight, borderWidth: 1 });
  page.drawText("ADMISSION NUMBER", { x: 404, y: 772, size: 7.5, font: bold, color: muted });
  page.drawText(draft.admissionNo, { x: 404, y: 757, size: 12, font: bold, color: darkBlue });
  page.drawText(`Status: ${draft.status}`, { x: 404, y: 744, size: 8, font, color: muted });

  page.drawLine({ start: { x: 42, y: 728 }, end: { x: 553, y: 728 }, thickness: 1.5, color: blue });
  y = 712;

  const learner = data.learner;
  section("1. Learner Personal Details");
  drawGridRow("Full Name", String(learner?.fullName || ""), "UPI / NEMIS No", String(learner?.upiNumber || ""));
  drawGridRow("Date of Birth", String(learner?.dateOfBirth || ""), "Gender", String(learner?.gender || ""));
  drawGridRow("Class Applied", String(learner?.grade || ""), "Stream", String(learner?.stream || ""));
  drawGridRow("Nationality", String(learner?.nationality || ""), "Religion", String(learner?.religion || ""));
  drawGridRow("Admission Date", String(learner?.admissionDate || ""), "Previous School", String(learner?.previousSchool || ""));
  if (learner?.reasonForLeaving) line(`Reason for Leaving: ${learner.reasonForLeaving}`, 8, muted);

  section("2. Residence & Transport");
  const residence = data.residence;
  drawGridRow("County", String(residence?.county || ""), "Sub-County", String(residence?.subCounty || ""));
  drawGridRow("Ward", String(residence?.ward || ""), "Village / Area", String(residence?.village || ""));
  drawGridRow("Physical Address", String(residence?.physicalAddress || ""), "Landmark", String(residence?.landmark || ""));
  drawGridRow("Distance to School", residence?.distanceToSchoolKm ? `${residence.distanceToSchoolKm} km` : "", "Means of Transport", String(residence?.transportMeans || ""));

  section("3. Parents & Legal Guardians");
  for (const [index, guardian] of (data.guardians ?? []).entries()) {
    line(`${index + 1}. ${guardian.fullName || "Guardian"} · ${guardian.relationship || "Guardian"}${guardian.primaryContact ? " (Primary Contact)" : ""}${guardian.paysFees ? " (Fee Payer)" : ""}`, 9, darkBlue, true);
    drawGridRow("Phone", String(guardian.phone || ""), "Email", String(guardian.email || ""));
    drawGridRow("National ID", String(guardian.idNumber || ""), "Occupation / Employer", [guardian.occupation, guardian.employer].filter(Boolean).join(" · "));
    if (guardian.homeAddress) line(`Home Address: ${guardian.homeAddress}`, 8, muted);
  }

  section("4. Emergency Contacts & Authorized Collection");
  for (const [index, contact] of (data.emergencyContacts ?? []).entries()) {
    drawGridRow(`Emergency #${index + 1}`, `${contact.fullName || "Not provided"} (${contact.relationship || "Contact"})`, "Phone", String(contact.phone || ""));
  }
  for (const [index, person] of (data.pickupPersons ?? []).entries()) {
    drawGridRow(`Pick-up #${index + 1}`, `${person.fullName || "Not provided"} (${person.relationship || "Collector"})`, "Phone", String(person.phone || ""));
  }

  section("5. Health & Wellbeing (Restricted School Record)");
  const health = data.health;
  drawGridRow("Blood Group", String(health?.bloodGroup || ""), "Immunization", String(health?.immunizationStatus || ""));
  drawGridRow("Doctor / Hospital", String(health?.doctorOrHospital || ""), "Health Insurance", String(health?.healthInsurance || ""));
  if (health?.knownConditions) line(`Known Medical Conditions: ${health.knownConditions}`, 8.5, darkBlue);
  if (health?.allergies) line(`Allergies: ${health.allergies}`, 8.5, darkBlue);
  if (health?.currentMedication) line(`Medication in use: ${health.currentMedication}`, 8.5, darkBlue);
  if (health?.specialNeeds) line(`Special Learning Needs / Disabilities: ${health.specialNeeds}`, 8.5, darkBlue);

  section("6. Fee Hand-Off & Administrative Notes");
  drawGridRow("Admission Term", String(data.fee?.term || ""), "Responsible Payer", String(data.fee?.feePayerGuardian || ""));
  drawGridRow("Optional Services", (data.fee?.requestedOptionalItems ?? []).join(", ") || "None requested", "Consent Given", data.consent ? "Yes (KDPA 2019 Verified)" : "No");
  if (data.fee?.handoffNote) line(`Accountant Note: ${data.fee.handoffNote}`, 8, muted);

  section("7. Verified Documents Checklist");
  for (const [category, label] of Object.entries(admissionDocumentCategoryLabels)) {
    const uploaded = draft.documents.some(document => document.category === category);
    line(`${uploaded ? "[X]" : "[ ]"} ${label}${category === "PASSPORT_PHOTO" || category === "BIRTH_CERTIFICATE" ? " (Mandatory)" : ""}`, 8, uploaded ? rgb(0.08, 0.42, 0.24) : muted);
  }
  const photo = draft.documents.find(document => document.category === "PASSPORT_PHOTO");
  if (photo && photo.contentType !== "application/pdf" && /^[a-f0-9-]{36}\.(jpg|png)$/.test(photo.storageKey)) {
    try {
      const bytes = await readStoredFile("private", `admissions/${id}/${photo.storageKey}`);
      const image = photo.contentType === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      ensure(118);
      const photoY = y - 102;
      page.drawImage(image, { x: 445, y: photoY, width: 78, height: 92, opacity: 0.98 });
      page.drawRectangle({ x: 445, y: photoY, width: 78, height: 92, borderColor: rgb(0.75, 0.81, 0.9), borderWidth: 1 });
      y -= 112;
    } catch { /* Keep the checklist and form usable if an image is corrupt. */ }
  }
  ensure(70);
  const signatureY = Math.max(45, y - 42);
  for (const [x, label] of [[48, "Parent / guardian signature"], [235, "Secretary"], [420, "Head Teacher"]] as const) {
    page.drawLine({ start: { x, y: signatureY }, end: { x: x + 130, y: signatureY }, thickness: 0.7, color: muted });
    page.drawText(label, { x, y: signatureY - 13, size: 7, font, color: muted });
  }
  page.drawText(`Date: ${new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date())}`, { x: 48, y: signatureY - 31, size: 8, font, color: muted });
  for (const item of pdf.getPages()) item.drawText("Mary Royal School · Confidential learner information · Obunga, Kisumu", { x: 42, y: 24, size: 7, font, color: muted });
  await db.auditEvent.create({ data: { actorId: user.id, action: "ADMISSION_FORM_EXPORTED", entity: "AdmissionDraft", entityId: id } });
  const bytes = await pdf.save();
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const inline = new URL(request.url).searchParams.get("download") === "0";
  return new NextResponse(body, { headers: { "content-type": "application/pdf", "content-disposition": `${inline ? "inline" : "attachment"}; filename="Mary-Royal-Admission-${draft.admissionNo}.pdf"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}

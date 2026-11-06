import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
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
      } else if (!line && font.widthOfTextAtSize(word, size) > width) {
        // A single unbroken token (email, URL) still has to fit the cell.
        let chunk = "";
        for (const char of word) {
          if (font.widthOfTextAtSize(chunk + char, size) > width && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk += char;
          }
        }
        line = chunk;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines.length ? lines : [""];
}

// Identifiers such as the admission number must never be truncated; shrink them instead.
function fitSize(value: string, font: PDFFont, preferred: number, minimum: number, width: number) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(value, size) > width) size -= 0.2;
  return Math.max(size, minimum);
}

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Director",
  HEAD_TEACHER: "Head Teacher",
  DEPUTY: "Deputy Head Teacher",
  SECRETARY: "Admissions Secretary",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  WELFARE_CHAIR: "Welfare Chair",
  NON_TEACHING_STAFF: "Non-Teaching Staff",
  PARENT: "Parent",
  LEARNER: "Learner"
};

const SHORT_STATUS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  ENROLLED: "Enrolled"
};

function displayDate(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
    }
  }
  return raw;
}

function displayDateTime(value: Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi"
  }).format(value);
}

const value = (input: unknown) => (input === null || input === undefined ? "" : String(input).trim());

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

  // Formal school-document palette: navy text, royal-blue structure, one gold hairline.
  const navy = rgb(0.043, 0.106, 0.2);
  const royal = rgb(0.114, 0.306, 0.847);
  const gold = rgb(0.78, 0.6, 0.17);
  const slate = rgb(0.357, 0.42, 0.51);
  const wash = rgb(0.955, 0.968, 0.988);
  const rule = rgb(0.855, 0.886, 0.933);
  const white = rgb(1, 1, 1);
  const success = rgb(0.055, 0.478, 0.235);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Admission Dossier ${draft.admissionNo} - Mary Royal School`);
  pdf.setAuthor("Mary Royal Primary & Junior School, Obunga, Kisumu");
  pdf.setSubject("Official learner admission and CBE enrolment record");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.28;
  const pageH = 841.89;
  const MX = 44;
  const CW = pageW - MX * 2;
  const CONTENT_FLOOR = 64;
  const LABEL_W = 122;

  let logo: PDFImage | null = null;
  try {
    const bytes = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
    logo = await pdf.embedPng(bytes);
  } catch {
    logo = null;
  }

  const generatedAt = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi"
  }).format(new Date());
  const generatedStamp = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi"
  }).format(new Date());

  const shortStatus = SHORT_STATUS[draft.status] ?? draft.status;
  const reference = `MR-ADM/${draft.admissionNo}`;
  const learner = data.learner;

  let page: PDFPage = pdf.addPage([pageW, pageH]);
  let pageIndex = 1;
  let y = 0;

  const drawLogo = (x: number, top: number, maxSize: number) => {
    if (!logo) return 0;
    const scale = Math.min(maxSize / logo.width, maxSize / logo.height);
    const width = logo.width * scale;
    const height = logo.height * scale;
    page.drawImage(logo, { x, y: top - height, width, height });
    return width;
  };

  const drawPageOneHeader = () => {
    page.drawRectangle({ x: 0, y: pageH - 26, width: pageW, height: 26, color: royal });
    page.drawRectangle({ x: 0, y: pageH - 28, width: pageW, height: 2, color: gold });

    const logoWidth = drawLogo(MX, pageH - 44, 54);
    const textX = MX + (logoWidth ? logoWidth + 14 : 0);

    page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", { x: textX, y: pageH - 68, size: 14.5, font: bold, color: navy });
    page.drawText("Nurturing Excellence Through CBE", { x: textX, y: pageH - 81, size: 7.8, font: bold, color: royal });
    page.drawText("P.O. Box 40100, Kisumu, Kenya  ·  Tel +254 718 216 374  ·  maryroyalschool81@gmail.com", {
      x: textX,
      y: pageH - 92,
      size: 7.2,
      font,
      color: slate
    });
    page.drawText("Obunga, near Breweries, Kisumu  ·  Ministry of Education / CBE registered", {
      x: textX,
      y: pageH - 101,
      size: 7.2,
      font,
      color: slate
    });

    const cardX = pageW - MX - 152;
    const cardTop = pageH - 44;
    const cardHeight = 66;
    page.drawRectangle({ x: cardX, y: cardTop - cardHeight, width: 152, height: cardHeight, color: wash, borderColor: rule, borderWidth: 0.6 });
    page.drawRectangle({ x: cardX, y: cardTop - cardHeight, width: 3, height: cardHeight, color: royal });
    page.drawText("OFFICIAL ADMISSION DOSSIER", { x: cardX + 11, y: cardTop - 14, size: 6.4, font: bold, color: royal });
    const admissionSize = fitSize(draft.admissionNo, bold, 10.5, 6.2, 128);
    page.drawText(draft.admissionNo, { x: cardX + 11, y: cardTop - 29, size: admissionSize, font: bold, color: navy });
    page.drawText(`Status  ${shortStatus}`, { x: cardX + 11, y: cardTop - 43, size: 7, font, color: slate });
    page.drawText(`Generated  ${generatedAt}`, { x: cardX + 11, y: cardTop - 55, size: 7, font, color: slate });

    page.drawLine({ start: { x: MX, y: pageH - 112 }, end: { x: pageW - MX, y: pageH - 112 }, thickness: 0.7, color: rule });

    page.drawRectangle({ x: MX, y: pageH - 138, width: CW, height: 22, color: navy });
    page.drawRectangle({ x: MX, y: pageH - 140, width: CW, height: 2, color: gold });
    page.drawText("LEARNER ADMISSION & CBE ENROLMENT RECORD", { x: MX + 10, y: pageH - 131, size: 9, font: bold, color: white });
    const refWidth = font.widthOfTextAtSize(reference, 7.2);
    page.drawText(reference, { x: pageW - MX - 10 - refWidth, y: pageH - 131, size: 7.2, font, color: white });

    y = pageH - 152;
  };

  const drawContinuationHeader = () => {
    const logoWidth = drawLogo(MX, pageH - 38, 22);
    const textX = MX + (logoWidth ? logoWidth + 10 : 0);
    page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", { x: textX, y: pageH - 46, size: 8, font: bold, color: navy });
    page.drawText(`Admission dossier  ·  ${reference}  ·  continued`, { x: textX, y: pageH - 56, size: 6.8, font, color: slate });
    const label = `Page ${pageIndex}`;
    const width = font.widthOfTextAtSize(label, 7.5);
    page.drawText(label, { x: pageW - MX - width, y: pageH - 46, size: 7.5, font: bold, color: royal });
    page.drawLine({ start: { x: MX, y: pageH - 68 }, end: { x: pageW - MX, y: pageH - 68 }, thickness: 0.6, color: rule });
    y = pageH - 80;
  };

  const breakPage = () => {
    page = pdf.addPage([pageW, pageH]);
    pageIndex += 1;
    drawContinuationHeader();
  };

  const ensure = (height: number) => {
    if (y - height < CONTENT_FLOOR) breakPage();
  };

  const section = (number: string, title: string) => {
    ensure(42);
    y -= 10;
    page.drawRectangle({ x: MX, y: y - 2, width: 2.5, height: 12, color: royal });
    page.drawText(number, { x: MX + 9, y, size: 8, font: bold, color: royal });
    page.drawText(title.toUpperCase(), { x: MX + 26, y, size: 8.3, font: bold, color: navy });
    y -= 8;
    page.drawLine({ start: { x: MX, y }, end: { x: pageW - MX, y }, thickness: 0.7, color: rule });
    y -= 3;
  };

  const subHeading = (title: string) => {
    const lines = wrap(title, bold, 7.9, CW);
    ensure(lines.length * 10 + 6);
    y -= 3;
    for (const line of lines) {
      page.drawText(line, { x: MX, y, size: 7.9, font: bold, color: royal });
      y -= 10;
    }
    y -= 1;
  };

  const record = (rows: Array<[string, string]>, options?: { width?: number; hideEmpty?: boolean }) => {
    const width = options?.width ?? CW;
    const visible = options?.hideEmpty ? rows.filter(([, entry]) => value(entry)) : rows;
    if (!visible.length) return;
    const valueX = MX + LABEL_W + 10;
    const valueWidth = width - LABEL_W - 18;

    for (const [label, entry] of visible) {
      const labelLines = wrap(label, bold, 7.1, LABEL_W - 18);
      const valueLines = wrap(value(entry) || "Not provided", font, 8.3, valueWidth);
      const height = Math.max(labelLines.length, valueLines.length) * 10.4 + 10;
      if (y - height < CONTENT_FLOOR) breakPage();

      const top = y;
      page.drawRectangle({ x: MX, y: top - height, width: LABEL_W, height, color: wash });
      page.drawLine({ start: { x: MX, y: top - height }, end: { x: MX + width, y: top - height }, thickness: 0.5, color: rule });
      page.drawLine({ start: { x: MX + LABEL_W, y: top }, end: { x: MX + LABEL_W, y: top - height }, thickness: 0.5, color: rule });

      let textY = top - 12;
      for (const item of labelLines) {
        page.drawText(item, { x: MX + 9, y: textY, size: 7.1, font: bold, color: slate });
        textY -= 10.4;
      }
      textY = top - 12.5;
      for (const item of valueLines) {
        page.drawText(item, { x: valueX, y: textY, size: 8.3, font, color: navy });
        textY -= 10.4;
      }
      y = top - height;
    }
    page.drawLine({ start: { x: MX, y }, end: { x: MX + width, y }, thickness: 0.5, color: rule });
  };

  const note = (label: string, entry: string) => {
    const content = value(entry);
    if (!content) return;
    const lines = wrap(content, font, 8.2, CW - 20);
    const height = lines.length * 10.4 + 22;
    ensure(height + 4);
    const top = y;
    page.drawRectangle({ x: MX, y: top - height, width: CW, height, color: wash });
    page.drawRectangle({ x: MX, y: top - height, width: 2, height, color: royal });
    page.drawText(label.toUpperCase(), { x: MX + 10, y: top - 12, size: 6.4, font: bold, color: slate });
    let textY = top - 24;
    for (const item of lines) {
      page.drawText(item, { x: MX + 10, y: textY, size: 8.2, font, color: navy });
      textY -= 10.4;
    }
    y = top - height;
    page.drawLine({ start: { x: MX, y }, end: { x: MX + CW, y }, thickness: 0.5, color: rule });
  };

  const snapshot = (items: Array<[string, string]>) => {
    const height = 38;
    ensure(height + 10);
    const width = CW / items.length;
    items.forEach(([label, entry], index) => {
      const x = MX + index * width;
      page.drawRectangle({ x, y: y - height, width, height, color: wash, borderColor: rule, borderWidth: 0.5 });
      page.drawText(label.toUpperCase(), { x: x + 9, y: y - 13, size: 6.1, font: bold, color: slate });
      const entryText = value(entry) || "Not provided";
      const entrySize = fitSize(entryText, bold, 8.4, 5.8, width - 18);
      page.drawText(entryText, { x: x + 9, y: y - 28, size: entrySize, font: bold, color: navy });
    });
    y -= height + 8;
  };

  const checkbox = (x: number, bottom: number, checked: boolean) => {
    page.drawRectangle({ x, y: bottom, width: 8, height: 8, borderColor: slate, borderWidth: 0.7, color: white });
    if (!checked) return;
    page.drawRectangle({ x, y: bottom, width: 8, height: 8, color: royal });
    page.drawLine({ start: { x: x + 1.8, y: bottom + 4.1 }, end: { x: x + 3.4, y: bottom + 1.9 }, thickness: 1.1, color: white });
    page.drawLine({ start: { x: x + 3.4, y: bottom + 1.9 }, end: { x: x + 6.4, y: bottom + 6 }, thickness: 1.1, color: white });
  };

  drawPageOneHeader();
  y -= 4;

  snapshot([
    ["Grade applied", value(learner?.grade)],
    ["Stream", value(learner?.stream)],
    ["Admission date", displayDate(learner?.admissionDate)],
    ["Status", shortStatus]
  ]);

  section("01", "Applicant summary");

  let photo: PDFImage | null = null;
  const attachedPhoto = draft.documents.find((document) => document.category === "PASSPORT_PHOTO");
  if (attachedPhoto && attachedPhoto.contentType !== "application/pdf" && /^[a-f0-9-]{36}\.(jpg|png)$/.test(attachedPhoto.storageKey)) {
    try {
      const bytes = await readStoredFile("private", `admissions/${id}/${attachedPhoto.storageKey}`);
      photo = attachedPhoto.contentType === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    } catch {
      photo = null;
    }
  }

  const showPhoto = Boolean(photo) && y - 118 > CONTENT_FLOOR;
  const photoWidth = showPhoto ? 92 : 0;
  const summaryTop = y;
  record(
    [
      ["Full legal name", value(learner?.fullName)],
      ["Date of birth", displayDate(learner?.dateOfBirth)],
      ["Gender", value(learner?.gender)],
      ["Nationality", value(learner?.nationality)],
      ["UPI / NEMIS number", value(learner?.upiNumber)],
      ["Previous school", value(learner?.previousSchool)]
    ],
    { width: showPhoto ? CW - photoWidth - 12 : CW }
  );

  if (photo && showPhoto) {
    const cardX = MX + CW - photoWidth;
    const cardHeight = 118;
    const cardBottom = summaryTop - cardHeight;
    page.drawRectangle({ x: cardX, y: cardBottom, width: photoWidth, height: cardHeight, color: white, borderColor: rule, borderWidth: 0.7 });
    page.drawText("APPLICANT PHOTO", { x: cardX + 7, y: cardBottom + 7, size: 5.8, font: bold, color: slate });
    const scale = Math.min((photoWidth - 12) / photo.width, (cardHeight - 26) / photo.height);
    const imageWidth = photo.width * scale;
    const imageHeight = photo.height * scale;
    page.drawImage(photo, {
      x: cardX + (photoWidth - imageWidth) / 2,
      y: cardBottom + 16 + (cardHeight - 26 - imageHeight) / 2,
      width: imageWidth,
      height: imageHeight
    });
    y = Math.min(y, cardBottom) - 8;
  }

  section("02", "Learner identification and class placement");
  record([
    ["Grade applied", value(learner?.grade)],
    ["Stream allocated", value(learner?.stream)],
    ["Admission date", displayDate(learner?.admissionDate)],
    ["Religion", value(learner?.religion)],
    ["Languages spoken", (learner?.languagesSpoken ?? []).join(", ")],
    ["Previous class", value(learner?.previousClass)],
    ["Reason for leaving", value(learner?.reasonForLeaving)]
  ]);

  section("03", "Residence, location and commute");
  const residence = data.residence;
  record([
    ["County", value(residence?.county)],
    ["Sub-county", value(residence?.subCounty)],
    ["Ward", value(residence?.ward)],
    ["Village / estate", value(residence?.village)],
    ["Physical address", value(residence?.physicalAddress)],
    ["Nearest landmark", value(residence?.landmark)],
    ["Distance to school", residence?.distanceToSchoolKm !== null && residence?.distanceToSchoolKm !== undefined ? `${residence.distanceToSchoolKm} km` : ""],
    ["Means of commute", value(residence?.transportMeans)]
  ]);

  section("04", "Parents and legal guardians");
  const guardians = data.guardians ?? [];
  if (!guardians.length) {
    record([["Guardian details", ""]]);
  } else {
    guardians.forEach((guardian, index) => {
      const tags = [guardian.primaryContact ? "Primary contact" : "", guardian.paysFees ? "Fee payer" : ""].filter(Boolean);
      subHeading(`${index + 1}. ${value(guardian.fullName) || "Guardian"} · ${value(guardian.relationship) || "Guardian"}${tags.length ? ` · ${tags.join(" · ")}` : ""}`);
      record(
        [
          ["Mobile phone", value(guardian.phone)],
          ["Alternate phone", value(guardian.alternatePhone)],
          ["Email address", value(guardian.email)],
          ["National ID / passport", value(guardian.idNumber)],
          ["Occupation", value(guardian.occupation)],
          ["Employer", value(guardian.employer)],
          ["Home address", value(guardian.homeAddress)],
          ["Work address", value(guardian.workAddress)]
        ],
        { hideEmpty: true }
      );
    });
  }

  section("05", "Emergency contacts and authorised pick-up");
  const emergencyContacts = data.emergencyContacts ?? [];
  if (!emergencyContacts.length) {
    record([["Emergency contact", ""]]);
  } else {
    emergencyContacts.forEach((contact, index) => {
      subHeading(`Emergency contact ${index + 1}`);
      record([
        ["Full name", value(contact.fullName)],
        ["Relationship", value(contact.relationship)],
        ["Phone", value(contact.phone)]
      ]);
    });
  }
  const pickupPersons = data.pickupPersons ?? [];
  if (pickupPersons.length) {
    subHeading("Authorised pick-up roster");
    record(
      pickupPersons.flatMap((person, index) => [
        [`Collector ${index + 1}`, value(person.fullName)],
        ["Relationship", value(person.relationship)],
        ["Phone", value(person.phone)]
      ])
    );
  }

  section("06", "Health and medical declaration");
  page.drawText("Confidential - restricted to authorised staff. Not printed for parents or learners.", {
    x: MX,
    y,
    size: 6.7,
    font,
    color: slate
  });
  y -= 12;
  const health = data.health;
  record([
    ["Blood group", value(health?.bloodGroup)],
    ["Immunisation status", value(health?.immunizationStatus)],
    ["Preferred hospital", value(health?.doctorOrHospital)],
    ["Health insurance", value(health?.healthInsurance)]
  ]);
  note("Known medical conditions", value(health?.knownConditions));
  note("Allergies", value(health?.allergies));
  note("Current medication", value(health?.currentMedication));
  note("Special educational needs", value(health?.specialNeeds));

  section("07", "Fee hand-off and data protection");
  record([
    ["Admission term", value(data.fee?.term)],
    ["Fee payer", value(data.fee?.feePayerGuardian)],
    ["Optional school services", (data.fee?.requestedOptionalItems ?? []).join(", ")],
    ["Data protection consent", data.consent ? "Granted - Kenya Data Protection Act 2019" : "Not recorded"]
  ]);
  note("Accountant hand-off note", value(data.fee?.handoffNote));

  section("08", "Verified document checklist");
  const documentEntries = Object.entries(admissionDocumentCategoryLabels);
  const columnWidth = CW / 2;
  for (let index = 0; index < documentEntries.length; index += 2) {
    ensure(18);
    for (let column = 0; column < 2 && index + column < documentEntries.length; column += 1) {
      const [category, label] = documentEntries[index + column];
      const uploaded = draft.documents.some((document) => document.category === category);
      const x = MX + column * columnWidth;
      checkbox(x + 1, y - 9, uploaded);
      const mandatory = category === "PASSPORT_PHOTO" || category === "BIRTH_CERTIFICATE" ? " (mandatory)" : "";
      const labelText = `${label}${mandatory}`;
      page.drawText(labelText, {
        x: x + 15,
        y: y - 9.5,
        size: fitSize(labelText, font, 7.6, 5.8, columnWidth - 68),
        font,
        color: uploaded ? navy : slate
      });
      if (uploaded) {
        page.drawText("Received", { x: x + columnWidth - 48, y: y - 9.5, size: 6.2, font: bold, color: success });
      }
    }
    y -= 17;
  }
  y -= 2;

  section("09", "Record history");
  record(
    [
      ["Record created", displayDateTime(draft.createdAt)],
      ["Submitted for approval", displayDateTime(draft.submittedAt)],
      ["Enrolment confirmed", displayDateTime(draft.enrolledAt ?? draft.learner?.admissionApprovedAt ?? null)],
      ["Last updated", displayDateTime(draft.updatedAt)],
      ["Issued by", ROLE_LABELS[user.role] ?? user.role]
    ],
    { hideEmpty: true }
  );

  section("10", "Declarations and institutional endorsement");
  const declaration =
    "The parent or legal guardian confirms that the information in this dossier is true and complete. The school confirms receipt of the documents listed above. Admission is confirmed only when this dossier is approved and the learner record is created.";
  const declarationLines = wrap(declaration, font, 7.7, CW);
  const cardHeight = 64;
  const panelHeight = 62;
  // Keep the declaration, signatures and verification panel together instead of orphaning the panel.
  ensure(declarationLines.length * 10 + 12 + cardHeight + 10 + panelHeight + 6);
  for (const item of declarationLines) {
    page.drawText(item, { x: MX, y, size: 7.7, font, color: navy });
    y -= 10;
  }
  y -= 10;

  const cardGap = 12;
  const cardWidth = (CW - cardGap * 2) / 3;
  ensure(cardHeight + 8);
  ["Parent / legal guardian", "Admissions secretary", "Head teacher / director"].forEach((title, index) => {
    const x = MX + index * (cardWidth + cardGap);
    page.drawRectangle({ x, y: y - cardHeight, width: cardWidth, height: cardHeight, color: white, borderColor: rule, borderWidth: 0.7 });
    page.drawText(title, { x: x + 9, y: y - 14, size: fitSize(title, bold, 7.2, 5.8, cardWidth - 16), font: bold, color: navy });
    page.drawLine({ start: { x: x + 9, y: y - cardHeight + 24 }, end: { x: x + cardWidth - 9, y: y - cardHeight + 24 }, thickness: 0.6, color: navy });
    page.drawText("Signature & date", { x: x + 9, y: y - cardHeight + 13, size: 6.3, font, color: slate });
  });
  y -= cardHeight + 10;

  ensure(panelHeight + 6);
  page.drawRectangle({ x: MX, y: y - panelHeight, width: CW, height: panelHeight, color: wash, borderColor: rule, borderWidth: 0.7 });
  page.drawRectangle({ x: MX, y: y - panelHeight, width: 3, height: panelHeight, color: royal });

  let qrWidth = 0;
  try {
    const qrData = `MARY_ROYAL_ADMISSION:${draft.id}:${draft.admissionNo}:${value(learner?.fullName) || "Learner"}:${draft.status}`;
    const matrix = generateQrMatrix(qrData);
    const size = 44;
    const pixel = size / matrix.length;
    const qrX = MX + 12;
    const qrY = y - panelHeight + 9;
    for (let row = 0; row < matrix.length; row += 1) {
      for (let column = 0; column < matrix[row].length; column += 1) {
        if (matrix[row][column]) {
          page.drawRectangle({
            x: qrX + column * pixel,
            y: qrY + (matrix.length - 1 - row) * pixel,
            width: pixel,
            height: pixel,
            color: navy
          });
        }
      }
    }
    qrWidth = size + 14;
  } catch {
    qrWidth = 0;
  }

  const textX = MX + 12 + qrWidth;
  const textWidth = CW - (textX - MX) - 12;
  page.drawText("DOCUMENT VERIFICATION", { x: textX, y: y - 16, size: 6.4, font: bold, color: royal });
  for (const [index, item] of wrap("Scan the code or quote the reference at the school office to confirm this dossier.", font, 7.4, textWidth).slice(0, 2).entries()) {
    page.drawText(item, { x: textX, y: y - 28 - index * 9.5, size: 7.4, font, color: navy });
  }
  const verifyLine = `Reference ${reference}  ·  ${shortStatus}  ·  Issued ${generatedAt}`;
  page.drawText(verifyLine, {
    x: textX,
    y: y - 48,
    size: fitSize(verifyLine, font, 6.6, 5.2, textWidth),
    font,
    color: slate
  });
  y -= panelHeight;

  const totalPages = pdf.getPageCount();
  for (let index = 0; index < totalPages; index += 1) {
    const footerPage = pdf.getPage(index);
    footerPage.drawLine({ start: { x: MX, y: 46 }, end: { x: pageW - MX, y: 46 }, thickness: 0.6, color: rule });
    footerPage.drawText(`Mary Royal Primary & Junior School · Obunga, Kisumu · ${reference}`, {
      x: MX,
      y: 34,
      size: 6.5,
      font,
      color: slate
    });
    const right = `Page ${index + 1} of ${totalPages} · generated ${generatedStamp} EAT`;
    const rightWidth = font.widthOfTextAtSize(right, 6.5);
    footerPage.drawText(right, { x: pageW - MX - rightWidth, y: 34, size: 6.5, font, color: slate });
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

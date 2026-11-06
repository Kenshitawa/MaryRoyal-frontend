import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { admissionDraftDataSchema, type AdmissionDraftData } from "@/lib/admissions";
import { generateQrMatrix } from "@/lib/qr";

// Standard PDF fonts use WinAnsi; normalise typographic characters so exported names never throw.
function pdfText(input: unknown) {
  const raw = input === null || input === undefined ? "" : String(input);
  return raw
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "?");
}

const value = (input: unknown) => pdfText(input).trim();

function wrap(input: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of input.split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(candidate, size) > width) {
        lines.push(line);
        line = word;
      } else if (!line && font.widthOfTextAtSize(word, size) > width) {
        // A single unbroken token (email, URL) still has to fit its cell.
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
function fitSize(text: string, font: PDFFont, preferred: number, minimum: number, width: number) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > width) size -= 0.2;
  return Math.max(size, minimum);
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending approval",
  APPROVED: "Approved - enrolled",
  REJECTED: "Not approved",
  TRANSFERRED: "Transferred",
  WITHDRAWN: "Withdrawn",
  ADMISSION_PENDING: "Admission pending"
};

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

function displayDate(input: unknown) {
  if (input instanceof Date) {
    if (Number.isNaN(input.getTime())) return "";
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Nairobi"
    }).format(input);
  }
  const raw = value(input);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
    }
  }
  return raw;
}

function displayDateTime(input: Date | null | undefined) {
  if (!input) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi"
  }).format(input);
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

  const { id } = await params;
  const schoolScope = canInScope(user.role, "learners", "view", "school");
  const linkedScope = canInScope(user.role, "learners", "view", "linked");
  const ownScope = canInScope(user.role, "learners", "view", "self");

  const learner = await db.learner.findUnique({
    where: { id },
    include: {
      profile: {
        include: {
          guardians: { orderBy: [{ primaryContact: "desc" }, { createdAt: "asc" }] },
          emergencyContacts: { orderBy: { createdAt: "asc" } },
          pickupPersons: { orderBy: { createdAt: "asc" } }
        }
      },
      admissionDraft: true,
      guardians: {
        include: { user: { select: { id: true, name: true, phone: true, email: true } } }
      }
    }
  });

  if (!learner) return NextResponse.json({ error: "Learner record not found." }, { status: 404 });

  if (!schoolScope) {
    // Parents and learners both reach the record through a guardian link; learner accounts are linked too.
    const isLinked = learner.guardians.some((link) => link.userId === user.id);
    if (!(isLinked && (linkedScope || ownScope))) {
      await db.auditEvent.create({ data: { actorId: user.id, action: "ACCESS_DENIED", entity: "Learner", entityId: learner.id } });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let data: AdmissionDraftData = {};
  if (learner.admissionDraft?.payload) {
    try {
      const parsed = admissionDraftDataSchema.safeParse(JSON.parse(learner.admissionDraft.payload) as unknown);
      if (parsed.success) data = parsed.data;
    } catch {
      data = {};
    }
  }

  const profile = learner.profile;
  const draftLearner = data.learner ?? {};
  const draftResidence = data.residence ?? {};

  // Formal school-document palette: navy text, royal-blue structure, one gold hairline.
  const navy = rgb(0.043, 0.106, 0.2);
  const royal = rgb(0.114, 0.306, 0.847);
  const gold = rgb(0.78, 0.6, 0.17);
  const slate = rgb(0.357, 0.42, 0.51);
  const wash = rgb(0.955, 0.968, 0.988);
  const rule = rgb(0.855, 0.886, 0.933);
  const white = rgb(1, 1, 1);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Admission Slip ${learner.admissionNo} - ${value(learner.name)} - Mary Royal School`);
  pdf.setAuthor("Mary Royal Primary & Junior School, Obunga, Kisumu");
  pdf.setSubject("Official learner admission slip and enrolment record");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.28;
  const pageH = 841.89;
  const MX = 44;
  const CW = pageW - MX * 2;
  const CONTENT_FLOOR = 64;
  const LABEL_W = 132;

  let logo: PDFImage | null = null;
  try {
    const bytes = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
    logo = await pdf.embedPng(bytes);
  } catch {
    logo = null;
  }

  const reference = `MR-SLIP/${learner.admissionNo}`;
  const status = STATUS_LABELS[learner.admissionStatus] ?? (value(learner.admissionStatus) || "Recorded");
  const generatedAt = displayDate(new Date().toISOString().slice(0, 10));
  const generatedStamp = displayDateTime(new Date());

  let page: PDFPage = pdf.addPage([pageW, pageH]);
  let pageIndex = 1;
  let y = 0;

  const drawLogo = (x: number, top: number, maxSize: number) => {
    if (logo) {
      const scale = Math.min(maxSize / logo.width, maxSize / logo.height);
      const width = logo.width * scale;
      const height = logo.height * scale;
      page.drawImage(logo, { x, y: top - height, width, height });
      return width;
    }
    page.drawRectangle({ x, y: top - maxSize, width: maxSize, height: maxSize, color: royal });
    page.drawRectangle({ x: x + 2.5, y: top - maxSize + 2.5, width: maxSize - 5, height: maxSize - 5, borderColor: gold, borderWidth: 0.8 });
    page.drawText("MR", {
      x: x + maxSize / 2 - maxSize * 0.19,
      y: top - maxSize / 2 - maxSize * 0.13,
      size: maxSize * 0.36,
      font: bold,
      color: white
    });
    return maxSize;
  };

  const drawPageOneHeader = () => {
    page.drawRectangle({ x: 0, y: pageH - 26, width: pageW, height: 26, color: royal });
    page.drawRectangle({ x: 0, y: pageH - 28, width: pageW, height: 2, color: gold });

    const logoWidth = drawLogo(MX, pageH - 44, 54);
    const textX = MX + (logoWidth ? logoWidth + 14 : 0);
    const cardX = pageW - MX - 152;
    const mastheadWidth = cardX - textX - 12;

    const schoolName = "MARY ROYAL PRIMARY & JUNIOR SCHOOL";
    page.drawText(schoolName, {
      x: textX,
      y: pageH - 68,
      size: fitSize(schoolName, bold, 14.5, 10.5, mastheadWidth),
      font: bold,
      color: navy
    });
    page.drawText("Hard Work Pays  ·  Nurturing Excellence Through CBE", { x: textX, y: pageH - 81, size: 7.8, font: bold, color: royal });
    const contactLine = "P.O. Box 40100, Kisumu  ·  Tel +254 718 216 374  ·  maryroyalschool81@gmail.com";
    page.drawText(contactLine, {
      x: textX,
      y: pageH - 92,
      size: fitSize(contactLine, font, 7.2, 6.2, mastheadWidth),
      font,
      color: slate
    });
    page.drawText("Obunga, near Breweries, Kisumu  ·  Ministry of Education / CBE registered", {
      x: textX,
      y: pageH - 101,
      size: fitSize("Obunga, near Breweries, Kisumu  ·  Ministry of Education / CBE registered", font, 7.2, 6.2, mastheadWidth),
      font,
      color: slate
    });

    const cardTop = pageH - 44;
    const cardHeight = 66;
    page.drawRectangle({ x: cardX, y: cardTop - cardHeight, width: 152, height: cardHeight, color: wash, borderColor: rule, borderWidth: 0.6 });
    page.drawRectangle({ x: cardX, y: cardTop - cardHeight, width: 3, height: cardHeight, color: royal });
    page.drawText("OFFICIAL ADMISSION SLIP", { x: cardX + 11, y: cardTop - 14, size: 6.4, font: bold, color: royal });
    const admissionSize = fitSize(pdfText(learner.admissionNo), bold, 10.5, 6.2, 128);
    page.drawText(pdfText(learner.admissionNo), { x: cardX + 11, y: cardTop - 29, size: admissionSize, font: bold, color: navy });
    page.drawText(`Status  ${status}`, { x: cardX + 11, y: cardTop - 43, size: fitSize(`Status  ${status}`, font, 7, 5.6, 130), font, color: slate });
    page.drawText(`Generated  ${generatedAt}`, { x: cardX + 11, y: cardTop - 55, size: 7, font, color: slate });

    page.drawLine({ start: { x: MX, y: pageH - 112 }, end: { x: pageW - MX, y: pageH - 112 }, thickness: 0.7, color: rule });

    page.drawRectangle({ x: MX, y: pageH - 138, width: CW, height: 22, color: navy });
    page.drawRectangle({ x: MX, y: pageH - 140, width: CW, height: 2, color: gold });
    page.drawText("LEARNER ADMISSION SLIP & ENROLMENT RECORD", { x: MX + 10, y: pageH - 131, size: 9, font: bold, color: white });
    const refWidth = font.widthOfTextAtSize(reference, 7.2);
    page.drawText(reference, { x: pageW - MX - 10 - refWidth, y: pageH - 131, size: 7.2, font, color: white });

    y = pageH - 152;
  };

  const drawContinuationHeader = () => {
    const logoWidth = drawLogo(MX, pageH - 38, 22);
    const textX = MX + (logoWidth ? logoWidth + 10 : 0);
    page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", { x: textX, y: pageH - 46, size: 8, font: bold, color: navy });
    page.drawText(`Admission slip  ·  ${reference}  ·  continued`, { x: textX, y: pageH - 56, size: 6.8, font, color: slate });
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
    ensure(44);
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

  const record = (rows: Array<[string, string]>) => {
    if (!rows.length) return;
    const valueX = MX + LABEL_W + 10;
    const valueWidth = CW - LABEL_W - 18;

    for (const [label, entry] of rows) {
      const labelLines = wrap(label, bold, 7.1, LABEL_W - 18);
      const valueLines = wrap(value(entry) || "Not provided", font, 8.3, valueWidth);
      const height = Math.max(labelLines.length, valueLines.length) * 10.4 + 10;
      // A label must never be orphaned from its value at the page break.
      ensure(height);

      const top = y;
      page.drawRectangle({ x: MX, y: top - height, width: LABEL_W, height, color: wash });
      page.drawLine({ start: { x: MX, y: top - height }, end: { x: MX + CW, y: top - height }, thickness: 0.5, color: rule });
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

  drawPageOneHeader();
  y -= 4;

  const admissionDate = profile?.admissionDate ?? learner.admissionApprovedAt ?? null;
  snapshot([
    ["Grade / class", value(learner.grade)],
    ["Stream", profile?.stream ?? draftLearner.stream ?? ""],
    ["Admission date", displayDate(admissionDate) || displayDate(draftLearner.admissionDate)],
    ["Status", status]
  ]);

  section("01", "Learner identification");
  record([
    ["Full legal name", value(learner.name)],
    ["Admission number", value(learner.admissionNo)],
    ["Date of birth", displayDate(profile?.dateOfBirth) || displayDate(draftLearner.dateOfBirth)],
    ["Gender", value(learner.gender)],
    ["Nationality", profile?.nationality ?? draftLearner.nationality ?? ""],
    ["UPI / NEMIS number", profile?.upiNumber ?? draftLearner.upiNumber ?? ""],
    ["Religion", profile?.religion ?? draftLearner.religion ?? ""],
    ["Languages spoken", (profile?.languagesSpoken ? profile.languagesSpoken.split(",").map((entry) => entry.trim()).filter(Boolean) : draftLearner.languagesSpoken ?? []).join(", ")]
  ]);

  section("02", "Enrolment details");
  record([
    ["Grade / class", value(learner.grade)],
    ["Stream", profile?.stream ?? draftLearner.stream ?? ""],
    ["Admission date", displayDate(admissionDate) || displayDate(draftLearner.admissionDate)],
    ["Enrolment confirmed", displayDateTime(learner.admissionApprovedAt)],
    ["Learning pathway", "Kenya Competency Based Curriculum (CBE)"],
    ["Previous school", profile?.previousSchool ?? draftLearner.previousSchool ?? ""],
    ["Previous class", profile?.previousClass ?? draftLearner.previousClass ?? ""],
    ["Reason for leaving", profile?.reasonForLeaving ?? draftLearner.reasonForLeaving ?? ""]
  ]);

  section("03", "Residence and transport");
  record([
    ["County", profile?.county ?? draftResidence.county ?? ""],
    ["Sub-county", profile?.subCounty ?? draftResidence.subCounty ?? ""],
    ["Ward", profile?.ward ?? draftResidence.ward ?? ""],
    ["Village / estate", profile?.village ?? draftResidence.village ?? ""],
    ["Physical address", profile?.physicalAddress ?? draftResidence.physicalAddress ?? ""],
    ["Nearest landmark", profile?.landmark ?? draftResidence.landmark ?? ""],
    [
      "Distance to school",
      profile?.distanceToSchoolKm !== null && profile?.distanceToSchoolKm !== undefined
        ? `${profile.distanceToSchoolKm} km`
        : draftResidence.distanceToSchoolKm !== null && draftResidence.distanceToSchoolKm !== undefined
          ? `${draftResidence.distanceToSchoolKm} km`
          : ""
    ],
    ["Means of transport", profile?.transportMeans ?? draftResidence.transportMeans ?? ""]
  ]);

  section("04", "Parent or legal guardian");
  const profileGuardians = profile?.guardians ?? [];
  const draftGuardians = data.guardians ?? [];
  const portalGuardians = learner.guardians;

  if (profileGuardians.length) {
    profileGuardians.forEach((guardian, index) => {
      subHeading(`Guardian ${index + 1}${guardian.primaryContact ? "  ·  primary contact" : ""}`);
      record([
        ["Full name", guardian.fullName],
        ["Relationship", guardian.relationship],
        ["Telephone", guardian.phone],
        ["Alternate telephone", guardian.alternatePhone ?? ""],
        ["Email address", guardian.email ?? ""],
        ["National ID / passport", guardian.idNumber ?? ""],
        ["Occupation", guardian.occupation ?? ""],
        ["Employer", guardian.employer ?? ""],
        ["Home address", guardian.homeAddress ?? ""],
        ["Fees responsibility", guardian.paysFees ? "Yes - responsible for school fees" : "No"]
      ]);
    });
  } else if (draftGuardians.length) {
    draftGuardians.forEach((guardian, index) => {
      subHeading(`Guardian ${index + 1}${guardian.primaryContact ? "  ·  primary contact" : ""}`);
      record([
        ["Full name", guardian.fullName ?? ""],
        ["Relationship", guardian.relationship ?? ""],
        ["Telephone", guardian.phone ?? ""],
        ["Alternate telephone", guardian.alternatePhone ?? ""],
        ["Email address", guardian.email ?? ""],
        ["National ID / passport", guardian.idNumber ?? ""],
        ["Occupation", guardian.occupation ?? ""],
        ["Employer", guardian.employer ?? ""],
        ["Home address", guardian.homeAddress ?? ""],
        ["Fees responsibility", guardian.paysFees ? "Yes - responsible for school fees" : "No"]
      ]);
    });
  } else if (portalGuardians.length) {
    portalGuardians.forEach((link, index) => {
      subHeading(`Guardian ${index + 1}`);
      record([
        ["Full name", link.user.name],
        ["Relationship", link.relation],
        ["Telephone", link.user.phone ?? ""],
        ["Email address", link.user.email ?? ""]
      ]);
    });
  } else {
    record([["Registered guardian", "Not provided"]]);
  }

  section("05", "Emergency contacts");
  const emergencyContacts = profile?.emergencyContacts ?? [];
  const draftEmergency = data.emergencyContacts ?? [];
  if (emergencyContacts.length) {
    emergencyContacts.forEach((contact) => {
      subHeading(contact.fullName);
      record([
        ["Relationship", contact.relationship],
        ["Telephone", contact.phone]
      ]);
    });
  } else if (draftEmergency.length) {
    draftEmergency.forEach((contact, index) => {
      subHeading(contact.fullName || `Emergency contact ${index + 1}`);
      record([
        ["Relationship", contact.relationship ?? ""],
        ["Telephone", contact.phone ?? ""]
      ]);
    });
  } else {
    record([["Emergency contact", "Not provided"]]);
  }

  section("06", "Authorised pickup persons");
  const pickupPersons = profile?.pickupPersons ?? [];
  const draftPickup = data.pickupPersons ?? [];
  if (pickupPersons.length) {
    pickupPersons.forEach((person) => {
      subHeading(person.fullName);
      record([
        ["Relationship", person.relationship],
        ["Telephone", person.phone]
      ]);
    });
  } else if (draftPickup.length) {
    draftPickup.forEach((person, index) => {
      subHeading(person.fullName || `Pickup person ${index + 1}`);
      record([
        ["Relationship", person.relationship ?? ""],
        ["Telephone", person.phone ?? ""]
      ]);
    });
  } else {
    record([["Authorised pickup", "No additional pickup persons authorised"]]);
  }

  const declaration =
    "The parent or legal guardian confirms that the information on this admission slip is true and complete, and undertakes to notify the school immediately of any change. The learner is admitted subject to the school code of conduct and continuous assessment under the Kenya Competency Based Curriculum. Personal data is held and processed in accordance with the Kenya Data Protection Act 2019.";
  const declarationLines = wrap(declaration, font, 7.7, CW);
  const signatureHeight = 64;
  const panelHeight = 62;
  const consentAt = profile?.consentAt ?? null;
  const consentLine = data.consent || consentAt
    ? `Data protection consent: granted${consentAt ? ` on ${displayDate(consentAt.toISOString().slice(0, 10))}` : ""}`
    : "Data protection consent: not recorded";

  ensure(declarationLines.length * 10 + 16 + signatureHeight + 10 + panelHeight + 30);
  section("07", "Declaration and institutional endorsement");
  for (const item of declarationLines) {
    page.drawText(item, { x: MX, y, size: 7.7, font, color: navy });
    y -= 10;
  }
  y -= 4;
  page.drawText(consentLine, { x: MX, y, size: 7.2, font: bold, color: slate });
  y -= 14;

  const cardGap = 12;
  const cardWidth = (CW - cardGap * 2) / 3;
  ensure(signatureHeight + 8);
  ["Parent / legal guardian", "Class teacher", "Head teacher / director"].forEach((title, index) => {
    const x = MX + index * (cardWidth + cardGap);
    page.drawRectangle({ x, y: y - signatureHeight, width: cardWidth, height: signatureHeight, color: white, borderColor: rule, borderWidth: 0.7 });
    page.drawText(title, { x: x + 9, y: y - 14, size: fitSize(title, bold, 7.2, 5.8, cardWidth - 16), font: bold, color: navy });
    page.drawLine({ start: { x: x + 9, y: y - signatureHeight + 24 }, end: { x: x + cardWidth - 9, y: y - signatureHeight + 24 }, thickness: 0.6, color: navy });
    page.drawText("Signature & date", { x: x + 9, y: y - signatureHeight + 13, size: 6.3, font, color: slate });
  });
  y -= signatureHeight + 10;

  ensure(panelHeight + 6);
  page.drawRectangle({ x: MX, y: y - panelHeight, width: CW, height: panelHeight, color: wash, borderColor: rule, borderWidth: 0.7 });
  page.drawRectangle({ x: MX, y: y - panelHeight, width: 3, height: panelHeight, color: royal });

  let qrWidth = 0;
  try {
    const qrData = `MARY_ROYAL_ADMISSION_SLIP:${learner.id}:${learner.admissionNo}:${value(learner.name)}:${learner.grade}:${learner.admissionStatus}`;
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
  for (const [index, item] of wrap("Scan the code or quote the reference at the school office to confirm this enrolment record.", font, 7.4, textWidth)
    .slice(0, 2)
    .entries()) {
    page.drawText(item, { x: textX, y: y - 28 - index * 9.5, size: 7.4, font, color: navy });
  }
  const verifyLine = `Reference ${reference}  ·  ${status}  ·  Issued ${generatedAt}  ·  ${ROLE_LABELS[user.role] ?? value(user.role)}`;
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
    footerPage.drawText("Mary Royal Primary & Junior School  ·  Obunga, Kisumu  ·  This slip is not a fee receipt.", {
      x: MX,
      y: 34,
      size: 6.5,
      font,
      color: slate
    });
    const right = `Page ${index + 1} of ${totalPages}  ·  ${reference}  ·  ${generatedStamp} EAT`;
    const rightWidth = font.widthOfTextAtSize(right, 6.5);
    footerPage.drawText(right, { x: pageW - MX - rightWidth, y: 34, size: 6.5, font, color: slate });
  }

  await db.auditEvent.create({
    data: { actorId: user.id, action: "ADMISSION_SLIP_EXPORTED", entity: "Learner", entityId: learner.id }
  });

  const bytes = await pdf.save();
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const inline = new URL(request.url).searchParams.get("download") === "0";
  const safeAdmissionNo = value(learner.admissionNo).replace(/[^A-Za-z0-9._-]+/g, "-") || learner.id;
  const safeName = value(learner.name).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "Learner";
  return new NextResponse(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="Mary-Royal-Admission-Slip-${safeAdmissionNo}-${safeName}.pdf"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

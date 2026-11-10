import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canInScope, canViewStaffStatutory } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { logSafeServerError } from "@/lib/safe-server-log";
import { generateQrMatrix } from "@/lib/qr";

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Director",
  HEAD_TEACHER: "Head Teacher",
  DEPUTY: "Deputy Head Teacher",
  SECRETARY: "Admissions Secretary",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  WELFARE_CHAIR: "Welfare Chair",
  NON_TEACHING_STAFF: "Non-Teaching Staff"
};

const DOCUMENT_LABELS: Record<string, string> = {
  ID_COPY: "National ID copy",
  TSC_CARD: "TSC registration card",
  ACADEMIC_CERTIFICATE: "Academic certificate",
  CV: "Curriculum vitae",
  CONTRACT: "Employment contract",
  PASSPORT_PHOTO: "Passport photo"
};

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

function fitSize(value: string, font: PDFFont, preferred: number, minimum: number, width: number) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(value, size) > width) size -= 0.2;
  return Math.max(size, minimum);
}

const value = (input: unknown) => (input === null || input === undefined ? "" : String(input).trim());

function displayDate(input: Date | null | undefined) {
  if (!input) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Nairobi" }).format(input);
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
  const token = (await cookies()).get("school_session")?.value;
  const session = token ? await readSession(token) : null;
  if (!session) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const actor = await db.user.findUnique({
    where: { id: session.id },
    select: { id: true, role: true, suspended: true, forcePasswordChange: true }
  });
  if (!actor || actor.suspended || actor.forcePasswordChange) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  if (actor.id !== id && !canInScope(actor.role, "staff", "view", "school")) {
    await db.auditEvent.create({ data: { actorId: actor.id, action: "ACCESS_DENIED", entity: "StaffDossier", entityId: id } });
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const canSeeStatutory = canViewStaffStatutory(actor.role);
  const showHistory = actor.role === "DIRECTOR";

  const staff = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      suspended: true,
      staffNumber: true,
      tscNumber: true,
      employmentTitle: true,
      qualifications: true,
      createdAt: true,
      staffProfile: {
        select: {
          id: true,
          gender: true,
          dateOfBirth: true,
          nationalId: true,
          nationality: true,
          maritalStatus: true,
          alternatePhone: true,
          residenceAddress: true,
          county: true,
          dateJoined: true,
          employmentType: true,
          department: true,
          lineManager: true,
          probationEndDate: true,
          educationHistory: true,
          professionalQualifications: true,
          certificates: true,
          specializations: true,
          yearsOfExperience: true,
          previousEmployers: true,
          ...(canSeeStatutory
            ? { kraPin: true, nssfNumber: true, shaNumber: true, bankName: true, bankAccountName: true, bankAccountNumber: true, bankBranch: true }
            : {}),
          emergencyContacts: { select: { fullName: true, relationship: true, phone: true, isNextOfKin: true } },
          referees: { select: { fullName: true, organization: true, title: true, phone: true, email: true } },
          documents: { select: { category: true, originalName: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "desc" } }
        }
      },
      assignments: { select: { grade: true, subject: true }, orderBy: [{ grade: "asc" }, { subject: "asc" }] },
      classTeacherAssignments: { select: { grade: true } }
    }
  }).catch((error: unknown) => {
    logSafeServerError("staff_dossier_export", error);
    return null;
  });

  if (!staff || ["PARENT", "LEARNER"].includes(staff.role)) {
    return NextResponse.json({ error: "Staff record not found." }, { status: 404 });
  }

  const [attendance, payroll] = await Promise.all([
    db.staffAttendance.findMany({
      where: { staffId: id },
      orderBy: { date: "desc" },
      take: 60,
      select: { date: true, status: true, checkInAt: true }
    }),
    canSeeStatutory
      ? db.payrollEntry.findMany({
          where: { staffId: id },
          orderBy: { period: "desc" },
          take: 6,
          select: { period: true, status: true, netAmount: true }
        })
      : []
  ]);

  const profile = staff.staffProfile;
  const editHistory =
    showHistory && profile
      ? await db.staffHistory.findMany({
          where: { staffProfileId: profile.id },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: { field: true, createdAt: true, actor: { select: { name: true } } }
        })
      : [];
  const reference = `MRS/STF/${staff.staffNumber || staff.id.slice(-6).toUpperCase()}`;
  const roleLabel = ROLE_LABELS[staff.role] ?? staff.role;

  const navy = rgb(0.043, 0.106, 0.2);
  const royal = rgb(0.114, 0.306, 0.847);
  const gold = rgb(0.78, 0.6, 0.17);
  const slate = rgb(0.357, 0.42, 0.51);
  const wash = rgb(0.955, 0.968, 0.988);
  const rule = rgb(0.855, 0.886, 0.933);
  const white = rgb(1, 1, 1);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Staff Dossier ${reference} - Mary Royal School`);
  pdf.setAuthor("Mary Royal Primary & Junior School, Obunga, Kisumu");
  pdf.setSubject("Official staff record slip");

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
    logo = await pdf.embedPng(await readFile(join(process.cwd(), "public", "mary-royal-logo.png")));
  } catch {
    logo = null;
  }

  const generatedAt = displayDate(new Date());
  const generatedStamp = displayDateTime(new Date());

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
    page.drawText("P.O. Box 40100, Kisumu, Kenya  Â·  Tel +254 718 216 374  Â·  maryroyalschool81@gmail.com", {
      x: textX,
      y: pageH - 92,
      size: 7.2,
      font,
      color: slate
    });
    page.drawText("Obunga, near Breweries, Kisumu  Â·  Ministry of Education / CBE registered", {
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
    page.drawText("OFFICIAL STAFF RECORD", { x: cardX + 11, y: cardTop - 14, size: 6.4, font: bold, color: royal });
    page.drawText(staff.staffNumber || "No staff number", {
      x: cardX + 11,
      y: cardTop - 29,
      size: fitSize(staff.staffNumber || "No staff number", bold, 10.5, 6.2, 128),
      font: bold,
      color: navy
    });
    page.drawText(`Status  ${staff.suspended ? "Suspended" : "Active"}`, { x: cardX + 11, y: cardTop - 43, size: 7, font, color: slate });
    page.drawText(`Generated  ${generatedAt}`, { x: cardX + 11, y: cardTop - 55, size: 7, font, color: slate });

    page.drawLine({ start: { x: MX, y: pageH - 112 }, end: { x: pageW - MX, y: pageH - 112 }, thickness: 0.7, color: rule });

    page.drawRectangle({ x: MX, y: pageH - 138, width: CW, height: 22, color: navy });
    page.drawRectangle({ x: MX, y: pageH - 140, width: CW, height: 2, color: gold });
    page.drawText("STAFF DOSSIER & RECORD SLIP", { x: MX + 10, y: pageH - 131, size: 9, font: bold, color: white });
    const refWidth = font.widthOfTextAtSize(reference, 7.2);
    page.drawText(reference, { x: pageW - MX - 10 - refWidth, y: pageH - 131, size: 7.2, font, color: white });

    y = pageH - 152;
  };

  const drawContinuationHeader = () => {
    const logoWidth = drawLogo(MX, pageH - 38, 22);
    const textX = MX + (logoWidth ? logoWidth + 10 : 0);
    page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", { x: textX, y: pageH - 46, size: 8, font: bold, color: navy });
    page.drawText(`Staff dossier  Â·  ${reference}  Â·  continued`, { x: textX, y: pageH - 56, size: 6.8, font, color: slate });
    const label = `Page ${pageIndex}`;
    page.drawText(label, { x: pageW - MX - font.widthOfTextAtSize(label, 7.5), y: pageH - 46, size: 7.5, font: bold, color: royal });
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

  const record = (rows: Array<[string, string]>, options?: { hideEmpty?: boolean }) => {
    const visible = options?.hideEmpty ? rows.filter(([, entry]) => value(entry)) : rows;
    if (!visible.length) return;
    const valueX = MX + LABEL_W + 10;
    const valueWidth = CW - LABEL_W - 18;

    for (const [label, entry] of visible) {
      const labelLines = wrap(label, bold, 7.1, LABEL_W - 18);
      const valueLines = wrap(value(entry) || "Not provided", font, 8.3, valueWidth);
      const height = Math.max(labelLines.length, valueLines.length) * 10.4 + 10;
      if (y - height < CONTENT_FLOOR) breakPage();

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
      page.drawText(entryText, { x: x + 9, y: y - 28, size: fitSize(entryText, bold, 8.4, 5.8, width - 18), font: bold, color: navy });
    });
    y -= height + 8;
  };

  drawPageOneHeader();
  y -= 4;

  snapshot([
    ["Designation", staff.employmentTitle || roleLabel],
    ["Department", value(profile?.department)],
    ["Employment", value(profile?.employmentType)],
    ["Status", staff.suspended ? "Suspended" : "Active"]
  ]);

  section("01", "Personal identification");
  record([
    ["Full legal name", staff.name],
    ["Gender", value(profile?.gender)],
    ["Date of birth", displayDate(profile?.dateOfBirth)],
    ["National ID / passport", value(profile?.nationalId)],
    ["Nationality", value(profile?.nationality)],
    ["Marital status", value(profile?.maritalStatus)],
    ["TSC number", value(staff.tscNumber)]
  ]);

  section("02", "Employment and institutional designation");
  record([
    ["Staff number", value(staff.staffNumber)],
    ["System role", roleLabel],
    ["Designation", value(staff.employmentTitle)],
    ["Department", value(profile?.department)],
    ["Employment type", value(profile?.employmentType)],
    ["Date joined", displayDate(profile?.dateJoined)],
    ["Probation ends", displayDate(profile?.probationEndDate)],
    ["Line manager", value(profile?.lineManager)],
    ["Years of experience", profile?.yearsOfExperience !== null && profile?.yearsOfExperience !== undefined ? `${profile.yearsOfExperience} years` : ""],
    ["Qualifications", value(staff.qualifications)]
  ]);

  section("03", "Contact and residential particulars");
  record([
    ["Official email", staff.email],
    ["Mobile phone", value(staff.phone)],
    ["Alternate phone", value(profile?.alternatePhone)],
    ["Residential address", value(profile?.residenceAddress)],
    ["County", value(profile?.county)]
  ]);

  section("04", "Education and professional record");
  note("Education history", value(profile?.educationHistory));
  note("Professional qualifications", value(profile?.professionalQualifications));
  note("Certificates", value(profile?.certificates));
  note("Specializations", value(profile?.specializations));
  note("Previous employers", value(profile?.previousEmployers));
  if (!value(profile?.educationHistory) && !value(profile?.professionalQualifications) && !value(profile?.certificates) && !value(profile?.specializations) && !value(profile?.previousEmployers)) {
    record([["Education and professional record", ""]]);
  }

  section("05", "Teaching and class allocations");
  const classGrades = Array.from(new Set(staff.classTeacherAssignments.map((item) => item.grade)));
  record(
    [
      ["Class teacher for", classGrades.length ? classGrades.join(", ") : ""],
      ["Learning areas assigned", staff.assignments.length ? Array.from(new Set(staff.assignments.map((item) => item.subject))).join(", ") : ""],
      ["Grade allocations", staff.assignments.length ? Array.from(new Set(staff.assignments.map((item) => item.grade))).join(", ") : ""]
    ],
    { hideEmpty: true }
  );
  if (!classGrades.length && !staff.assignments.length) record([["Teaching allocations", ""]]);

  section("06", "Emergency contacts and next of kin");
  if (profile?.emergencyContacts.length) {
    profile.emergencyContacts.forEach((contact, index) => {
      subHeading(`${index + 1}. ${contact.fullName}${contact.isNextOfKin ? " Â· Next of kin" : ""}`);
      record([
        ["Relationship", contact.relationship],
        ["Phone", contact.phone]
      ]);
    });
  } else {
    record([["Emergency contact", ""]]);
  }

  section("07", "Referees");
  if (profile?.referees.length) {
    profile.referees.forEach((referee, index) => {
      subHeading(`${index + 1}. ${referee.fullName}${referee.title ? ` Â· ${referee.title}` : ""}`);
      record(
        [
          ["Organisation", value(referee.organization)],
          ["Phone", value(referee.phone)],
          ["Email", value(referee.email)]
        ],
        { hideEmpty: true }
      );
    });
  } else {
    record([["Referee", ""]]);
  }

  section("08", "Personnel document register");
  if (profile?.documents.length) {
    profile.documents.forEach((document, index) => {
      const size = document.sizeBytes >= 1024 * 1024 ? `${(document.sizeBytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(document.sizeBytes / 1024))} KB`;
      record([
        [`Document ${index + 1}`, `${DOCUMENT_LABELS[document.category] ?? document.category} Â· ${document.originalName}`],
        ["Received", `${displayDate(document.createdAt)} Â· ${size}`]
      ]);
    });
  } else {
    record([["Documents on file", ""]]);
  }

  section("09", "Attendance summary (last 60 records)");
  const attendanceCounts = attendance.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.status] = (counts[entry.status] ?? 0) + 1;
    return counts;
  }, {});
  record([
    ["Records reviewed", String(attendance.length)],
    ["Present", String(attendanceCounts.PRESENT ?? 0)],
    ["Late", String(attendanceCounts.LATE ?? 0)],
    ["Absent", String(attendanceCounts.ABSENT ?? 0)],
    ["Most recent check-in", attendance[0] ? `${displayDate(attendance[0].date)} Â· ${attendance[0].status}` : ""]
  ]);

  if (canSeeStatutory) {
    section("10", "Statutory and payroll details (restricted)");
    record([
      ["KRA PIN", value(profile?.kraPin)],
      ["NSSF number", value(profile?.nssfNumber)],
      ["SHA / NHIF number", value(profile?.shaNumber)],
      ["Bank name", value(profile?.bankName)],
      ["Account name", value(profile?.bankAccountName)],
      ["Account number", value(profile?.bankAccountNumber)],
      ["Bank branch", value(profile?.bankBranch)]
    ]);
    if (payroll.length) {
      subHeading("Recent payroll entries");
      record(
        payroll.map((entry) => [
          entry.period,
          `KES ${Number(entry.netAmount).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Â· ${entry.status}`
        ])
      );
    }
  }

  if (showHistory) {
    section("11", "Record edit history (Director)");
    if (editHistory.length) {
      record(editHistory.map((entry) => [`${displayDate(entry.createdAt)} Â· ${entry.actor.name}`, entry.field]));
    } else {
      record([["Edits recorded", ""]]);
    }
  }

  const declaration = "This dossier is issued from the school's official staff register for administrative and verification purposes. It must not be copied or shared beyond the school's authorised officers. Statutory and payroll details are restricted and every access is recorded in the append-only audit log.";
  const declarationLines = wrap(declaration, font, 7.7, CW);
  const cardHeight = 58;
  const panelHeight = 62;
  // Reserve the whole closing block before drawing the heading so it is never orphaned.
  ensure(declarationLines.length * 10 + 12 + cardHeight + 10 + panelHeight + 40);
  section(showHistory && canSeeStatutory ? "12" : showHistory || canSeeStatutory ? "11" : "10", "Declaration and verification");
  for (const item of declarationLines) {
    page.drawText(item, { x: MX, y, size: 7.7, font, color: navy });
    y -= 10;
  }
  y -= 10;

  const cardGap = 12;
  const cardWidth = (CW - cardGap * 2) / 3;
  ["Staff member", "Head teacher", "Director"].forEach((title, index) => {
    const x = MX + index * (cardWidth + cardGap);
    page.drawRectangle({ x, y: y - cardHeight, width: cardWidth, height: cardHeight, color: white, borderColor: rule, borderWidth: 0.7 });
    page.drawText(title, { x: x + 9, y: y - 14, size: 7.2, font: bold, color: navy });
    page.drawLine({ start: { x: x + 9, y: y - cardHeight + 24 }, end: { x: x + cardWidth - 9, y: y - cardHeight + 24 }, thickness: 0.6, color: navy });
    page.drawText("Signature & date", { x: x + 9, y: y - cardHeight + 13, size: 6.3, font, color: slate });
  });
  y -= cardHeight + 10;

  page.drawRectangle({ x: MX, y: y - panelHeight, width: CW, height: panelHeight, color: wash, borderColor: rule, borderWidth: 0.7 });
  page.drawRectangle({ x: MX, y: y - panelHeight, width: 3, height: panelHeight, color: royal });

  let qrWidth = 0;
  try {
    const matrix = generateQrMatrix(`MARY_ROYAL_STAFF:${staff.id}:${staff.staffNumber ?? ""}:${reference}`);
    const size = 44;
    const pixel = size / matrix.length;
    const qrX = MX + 12;
    const qrY = y - panelHeight + 9;
    for (let row = 0; row < matrix.length; row += 1) {
      for (let column = 0; column < matrix[row].length; column += 1) {
        if (matrix[row][column]) {
          page.drawRectangle({ x: qrX + column * pixel, y: qrY + (matrix.length - 1 - row) * pixel, width: pixel, height: pixel, color: navy });
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
  for (const [index, item] of wrap("Scan the code or quote the reference at the school office to confirm this staff record.", font, 7.4, textWidth).slice(0, 2).entries()) {
    page.drawText(item, { x: textX, y: y - 28 - index * 9.5, size: 7.4, font, color: navy });
  }
  const verifyLine = `Reference ${reference}  Â·  ${roleLabel}  Â·  Issued ${generatedAt}`;
  page.drawText(verifyLine, { x: textX, y: y - 48, size: fitSize(verifyLine, font, 6.6, 5.2, textWidth), font, color: slate });
  y -= panelHeight;

  const totalPages = pdf.getPageCount();
  for (let index = 0; index < totalPages; index += 1) {
    const footerPage = pdf.getPage(index);
    footerPage.drawLine({ start: { x: MX, y: 46 }, end: { x: pageW - MX, y: 46 }, thickness: 0.6, color: rule });
    footerPage.drawText(`Mary Royal Primary & Junior School Â· Obunga, Kisumu Â· ${reference}`, { x: MX, y: 34, size: 6.5, font, color: slate });
    const right = `Page ${index + 1} of ${totalPages} Â· generated ${generatedStamp} EAT`;
    footerPage.drawText(right, { x: pageW - MX - font.widthOfTextAtSize(right, 6.5), y: 34, size: 6.5, font, color: slate });
  }

  await db.auditEvent.create({
    data: { actorId: actor.id, action: "STAFF_DOSSIER_EXPORTED", entity: "StaffProfile", entityId: id }
  });
  if (canSeeStatutory) {
    await db.auditEvent.create({
      data: { actorId: actor.id, action: "STAFF_STATUTORY_VIEWED", entity: "StaffProfile", entityId: id }
    });
  }

  const bytes = await pdf.save();
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const inline = new URL(request.url).searchParams.get("download") === "0";
  const safeName = staff.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Staff";
  return new NextResponse(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="Mary-Royal-Staff-${safeName}.pdf"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

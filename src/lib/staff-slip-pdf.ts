import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export type StaffSlipAssignment = { grade: string; subject: string };

export type StaffSlipInput = {
  name: string;
  role: string;
  staffNumber?: string;
  tscNumber?: string;
  department?: string;
  employmentType?: string;
  phone?: string;
  county?: string;
  email: string;
  temporaryPassword: string;
  classTeacherGrade?: string;
  assignments: StaffSlipAssignment[];
  generatedAt?: Date;
};

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

function fitSize(text: string, font: PDFFont, preferred: number, minimum: number, width: number) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > width) size -= 0.2;
  return Math.max(size, minimum);
}

const ROLE_LABELS: Record<string, string> = {
  DIRECTOR: "Director",
  HEAD_TEACHER: "Head Teacher",
  DEPUTY: "Deputy Head Teacher",
  SECRETARY: "Secretary",
  ACCOUNTANT: "Accountant",
  TEACHER: "Teacher",
  WELFARE_CHAIR: "Welfare Chair",
  NON_TEACHING_STAFF: "Non-Teaching Staff"
};

export async function buildStaffSlipPdf(input: StaffSlipInput, logoBytes?: ArrayBuffer | Uint8Array | null): Promise<Uint8Array> {
  const navy = rgb(0.043, 0.106, 0.2);
  const royal = rgb(0.114, 0.306, 0.847);
  const gold = rgb(0.78, 0.6, 0.17);
  const slate = rgb(0.357, 0.42, 0.51);
  const wash = rgb(0.955, 0.968, 0.988);
  const rule = rgb(0.855, 0.886, 0.933);
  const white = rgb(1, 1, 1);
  const credentialWash = rgb(0.937, 0.965, 1);

  const generated = input.generatedAt ?? new Date();
  const generatedDate = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Africa/Nairobi"
  }).format(generated);
  const generatedStamp = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi"
  }).format(generated);

  const reference = `MRS/ACC/${value(input.staffNumber) || "NEW"}`;
  const roleLabel = ROLE_LABELS[input.role] ?? (value(input.role).replaceAll("_", " ") || "Staff");

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Staff Record ${value(input.staffNumber) || value(input.name)} - Mary Royal School`);
  pdf.setAuthor("Mary Royal Primary & Junior School, Obunga, Kisumu");
  pdf.setSubject("Official staff record and sign-in credential slip");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.28;
  const pageH = 841.89;
  const MX = 44;
  const CW = pageW - MX * 2;
  const CONTENT_FLOOR = 64;
  const LABEL_W = 146;

  let logo: PDFImage | null = null;
  if (logoBytes) {
    try {
      logo = await pdf.embedPng(logoBytes);
    } catch {
      logo = null;
    }
  }

  let page: PDFPage = pdf.addPage([pageW, pageH]);
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

  const drawHeader = () => {
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
    const addressLine = "Obunga, near Breweries, Kisumu  ·  Ministry of Education / CBE registered";
    page.drawText(addressLine, {
      x: textX,
      y: pageH - 101,
      size: fitSize(addressLine, font, 7.2, 6.2, mastheadWidth),
      font,
      color: slate
    });

    const cardTop = pageH - 44;
    const cardHeight = 66;
    page.drawRectangle({ x: cardX, y: cardTop - cardHeight, width: 152, height: cardHeight, color: wash, borderColor: rule, borderWidth: 0.6 });
    page.drawRectangle({ x: cardX, y: cardTop - cardHeight, width: 3, height: cardHeight, color: royal });
    page.drawText("OFFICIAL STAFF SLIP", { x: cardX + 11, y: cardTop - 14, size: 6.4, font: bold, color: royal });
    const staffNumber = value(input.staffNumber) || "NEW";
    page.drawText(staffNumber, { x: cardX + 11, y: cardTop - 29, size: fitSize(staffNumber, bold, 10.5, 6.2, 128), font: bold, color: navy });
    page.drawText(`Role  ${roleLabel}`, { x: cardX + 11, y: cardTop - 43, size: fitSize(`Role  ${roleLabel}`, font, 7, 5.6, 130), font, color: slate });
    page.drawText(`Generated  ${generatedDate}`, { x: cardX + 11, y: cardTop - 55, size: 7, font, color: slate });

    page.drawLine({ start: { x: MX, y: pageH - 112 }, end: { x: pageW - MX, y: pageH - 112 }, thickness: 0.7, color: rule });

    page.drawRectangle({ x: MX, y: pageH - 138, width: CW, height: 22, color: navy });
    page.drawRectangle({ x: MX, y: pageH - 140, width: CW, height: 2, color: gold });
    page.drawText("STAFF RECORD & SIGN-IN CREDENTIALS", { x: MX + 10, y: pageH - 131, size: 9, font: bold, color: white });
    const refWidth = font.widthOfTextAtSize(reference, 7.2);
    page.drawText(reference, { x: pageW - MX - 10 - refWidth, y: pageH - 131, size: 7.2, font, color: white });

    y = pageH - 152;
  };

  const ensure = (height: number) => {
    if (y - height < CONTENT_FLOOR) {
      page = pdf.addPage([pageW, pageH]);
      const logoWidth = drawLogo(MX, pageH - 38, 22);
      const textX = MX + (logoWidth ? logoWidth + 10 : 0);
      page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", { x: textX, y: pageH - 46, size: 8, font: bold, color: navy });
      page.drawText(`Staff slip  ·  ${reference}  ·  continued`, { x: textX, y: pageH - 56, size: 6.8, font, color: slate });
      page.drawLine({ start: { x: MX, y: pageH - 68 }, end: { x: pageW - MX, y: pageH - 68 }, thickness: 0.6, color: rule });
      y = pageH - 80;
    }
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

  const record = (rows: Array<[string, string]>) => {
    const valueX = MX + LABEL_W + 10;
    const valueWidth = CW - LABEL_W - 18;
    for (const [label, entry] of rows) {
      const labelLines = wrap(label, bold, 7.1, LABEL_W - 18);
      const valueLines = wrap(value(entry) || "Not provided", font, 8.3, valueWidth);
      const height = Math.max(labelLines.length, valueLines.length) * 10.4 + 10;
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

  drawHeader();

  section("01", "Staff particulars");
  record([
    ["Full name", value(input.name)],
    ["Assigned role", roleLabel],
    ["Staff number", value(input.staffNumber)],
    ["TSC number", value(input.tscNumber)],
    ["Department", value(input.department)],
    ["Employment type", value(input.employmentType)],
    ["Telephone", value(input.phone)],
    ["County", value(input.county)],
    ["Official email", value(input.email)]
  ]);

  section("02", "Class teacher and teaching allocations");
  const assignmentText = input.assignments.length
    ? input.assignments.map((assignment) => `${value(assignment.grade)}: ${value(assignment.subject)}`).join("; ")
    : "None assigned";
  record([
    ["Class teacher", value(input.classTeacherGrade) ? `Class Teacher: ${value(input.classTeacherGrade)}` : "Not assigned as Class Teacher"],
    ["Teaching subjects", assignmentText]
  ]);

  section("03", "System sign-in credentials");
  record([["Official email / username", value(input.email)]]);

  const boxHeight = 62;
  ensure(boxHeight + 8);
  page.drawRectangle({ x: MX, y: y - boxHeight, width: CW, height: boxHeight, color: credentialWash, borderColor: rule, borderWidth: 0.7 });
  page.drawRectangle({ x: MX, y: y - boxHeight, width: 3, height: boxHeight, color: royal });
  page.drawText("ONE-TIME TEMPORARY PASSWORD", { x: MX + 12, y: y - 15, size: 6.4, font: bold, color: royal });
  const password = value(input.temporaryPassword);
  page.drawText(password, {
    x: MX + 12,
    y: y - 36,
    size: fitSize(password, bold, 16, 9, CW - 24),
    font: bold,
    color: navy
  });
  const notice = "The staff member must change this password at first sign-in. Hand this slip over in private.";
  page.drawText(notice, { x: MX + 12, y: y - 52, size: fitSize(notice, font, 7, 5.8, CW - 24), font, color: slate });
  y -= boxHeight + 10;

  const declaration =
    "This slip confirms the staff account recorded above and is issued for one-time credential hand-over. The staff member accepts the school code of conduct, data-protection obligations and role permissions attached to the assigned position.";
  const declarationLines = wrap(declaration, font, 7.7, CW);
  const signatureHeight = 58;
  ensure(declarationLines.length * 10 + 12 + signatureHeight + 30);
  section("04", "Declaration and endorsement");
  for (const item of declarationLines) {
    page.drawText(item, { x: MX, y, size: 7.7, font, color: navy });
    y -= 10;
  }
  y -= 10;

  const cardGap = 12;
  const cardWidth = (CW - cardGap) / 2;
  ensure(signatureHeight + 8);
  ["Staff member", "Head teacher / director"].forEach((title, index) => {
    const x = MX + index * (cardWidth + cardGap);
    page.drawRectangle({ x, y: y - signatureHeight, width: cardWidth, height: signatureHeight, color: white, borderColor: rule, borderWidth: 0.7 });
    page.drawText(title, { x: x + 9, y: y - 14, size: fitSize(title, bold, 7.2, 5.8, cardWidth - 16), font: bold, color: navy });
    page.drawLine({ start: { x: x + 9, y: y - signatureHeight + 24 }, end: { x: x + cardWidth - 9, y: y - signatureHeight + 24 }, thickness: 0.6, color: navy });
    page.drawText("Signature & date", { x: x + 9, y: y - signatureHeight + 13, size: 6.3, font, color: slate });
  });
  y -= signatureHeight + 8;

  const totalPages = pdf.getPageCount();
  for (let index = 0; index < totalPages; index += 1) {
    const footerPage = pdf.getPage(index);
    footerPage.drawLine({ start: { x: MX, y: 46 }, end: { x: pageW - MX, y: 46 }, thickness: 0.6, color: rule });
    footerPage.drawText("Mary Royal Primary & Junior School  ·  Confidential - contains one-time credentials.", {
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

  return pdf.save();
}

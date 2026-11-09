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

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
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

function displayDate(val: unknown) {
  const raw = val === null || val === undefined ? "" : String(val).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(`${raw}T00:00:00Z`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
    }
  }
  return raw;
}

function displayDateTime(val: Date | null | undefined) {
  if (!val) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Nairobi"
  }).format(val);
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

  // Formal royal school-document palette
  const deepNavy = rgb(0.027, 0.071, 0.141);
  const royal = rgb(0.114, 0.306, 0.847);
  const darkRoyal = rgb(0.086, 0.22, 0.58);
  const gold = rgb(0.78, 0.6, 0.17);
  const lightGold = rgb(0.96, 0.92, 0.82);
  const slate = rgb(0.357, 0.42, 0.51);
  const wash = rgb(0.965, 0.976, 0.992);
  const cardBorder = rgb(0.855, 0.886, 0.933);
  const white = rgb(1, 1, 1);
  const success = rgb(0.055, 0.478, 0.235);
  const greenWash = rgb(0.92, 0.97, 0.94);
  const greenBorder = rgb(0.74, 0.89, 0.78);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Admission Dossier ${draft.admissionNo} - Mary Royal School`);
  pdf.setAuthor("Mary Royal Primary & Junior School, Obunga, Kisumu");
  pdf.setSubject("Official learner admission and CBE enrolment record");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.28;
  const pageH = 841.89;
  const MX = 36;
  const CW = pageW - MX * 2;
  const CONTENT_FLOOR = 60;
  const COL_GAP = 8;
  const COL_W = (CW - COL_GAP) / 2;

  let logo: PDFImage | null = null;
  try {
    const bytes = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
    logo = await pdf.embedPng(bytes);
  } catch {
    logo = null;
  }

  // Load applicant photo if available
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
  const isEnrolled = draft.status === "ENROLLED" || draft.status === "APPROVED";
  const reference = `MR-ADM/${draft.admissionNo}`;
  const learner = data.learner;

  let page: PDFPage = pdf.addPage([pageW, pageH]);
  let pageIndex = 1;
  let y = 0;

  // Draws an authentic double certificate border on each page
  const drawPageBorder = (p: PDFPage) => {
    // Outer royal border
    p.drawRectangle({
      x: 18,
      y: 18,
      width: pageW - 36,
      height: pageH - 36,
      borderColor: royal,
      borderWidth: 0.8
    });
    // Inner gold hairline
    p.drawRectangle({
      x: 21,
      y: 21,
      width: pageW - 42,
      height: pageH - 42,
      borderColor: gold,
      borderWidth: 0.4
    });
    // Corner accent squares
    const cornerSize = 6;
    const corners = [
      { x: 17, y: 17 },
      { x: pageW - 19 - cornerSize, y: 17 },
      { x: 17, y: pageH - 19 - cornerSize },
      { x: pageW - 19 - cornerSize, y: pageH - 19 - cornerSize }
    ];
    for (const c of corners) {
      p.drawRectangle({ x: c.x, y: c.y, width: cornerSize, height: cornerSize, color: royal });
      p.drawRectangle({ x: c.x + 1.2, y: c.y + 1.2, width: cornerSize - 2.4, height: cornerSize - 2.4, color: gold });
    }
  };

  const drawLogo = (p: PDFPage, x: number, top: number, maxSize: number) => {
    if (logo) {
      const scale = Math.min(maxSize / logo.width, maxSize / logo.height);
      const width = logo.width * scale;
      const height = logo.height * scale;
      p.drawImage(logo, { x, y: top - height, width, height });
      return width;
    }
    p.drawRectangle({ x, y: top - maxSize, width: maxSize, height: maxSize, color: royal });
    p.drawRectangle({ x: x + 2.5, y: top - maxSize + 2.5, width: maxSize - 5, height: maxSize - 5, borderColor: gold, borderWidth: 0.8 });
    p.drawText("MR", {
      x: x + maxSize / 2 - maxSize * 0.19,
      y: top - maxSize / 2 - maxSize * 0.13,
      size: maxSize * 0.36,
      font: bold,
      color: white
    });
    return maxSize;
  };

  const drawPageOneHeader = () => {
    drawPageBorder(page);

    // Top decorative bar
    page.drawRectangle({ x: MX, y: pageH - 32, width: CW, height: 4, color: royal });
    page.drawRectangle({ x: MX, y: pageH - 34, width: CW, height: 1.5, color: gold });

    const logoWidth = drawLogo(page, MX, pageH - 44, 52);
    const textX = MX + (logoWidth ? logoWidth + 12 : 0);
    const cardW = 146;
    const cardX = pageW - MX - cardW;
    const mastheadWidth = cardX - textX - 10;

    const schoolName = "MARY ROYAL PRIMARY & JUNIOR SCHOOL";
    page.drawText(schoolName, {
      x: textX,
      y: pageH - 58,
      size: fitSize(schoolName, bold, 14, 10, mastheadWidth),
      font: bold,
      color: deepNavy
    });
    page.drawText("MINISTRY OF EDUCATION · CBC / CBE ACCREDITED INSTITUTION", {
      x: textX,
      y: pageH - 69,
      size: 6.8,
      font: bold,
      color: slate
    });
    page.drawText("“Hard Work Pays · Nurturing Excellence Through CBE”", {
      x: textX,
      y: pageH - 79,
      size: 7.4,
      font: bold,
      color: darkRoyal
    });
    const contactLine = "P.O. Box 40100, Kisumu, Kenya · Tel: +254 718 216 374 · maryroyalschool81@gmail.com";
    page.drawText(contactLine, {
      x: textX,
      y: pageH - 89,
      size: fitSize(contactLine, font, 6.6, 5.8, mastheadWidth),
      font,
      color: slate
    });
    page.drawText("Campus: Obunga (Near Breweries), Central Kisumu Sub-County, Kisumu County", {
      x: textX,
      y: pageH - 98,
      size: fitSize("Campus: Obunga (Near Breweries), Central Kisumu Sub-County, Kisumu County", font, 6.6, 5.8, mastheadWidth),
      font,
      color: slate
    });

    // Executive document badge card (top right)
    const cardTop = pageH - 42;
    const cardHeight = 64;
    page.drawRectangle({
      x: cardX,
      y: cardTop - cardHeight,
      width: cardW,
      height: cardHeight,
      color: wash,
      borderColor: cardBorder,
      borderWidth: 0.7
    });
    page.drawRectangle({ x: cardX, y: cardTop - 3.5, width: cardW, height: 3.5, color: royal });

    page.drawText("OFFICIAL ADMISSION DOSSIER", { x: cardX + 9, y: cardTop - 13, size: 6.2, font: bold, color: royal });
    const admissionSize = fitSize(draft.admissionNo, bold, 11, 7.5, cardW - 18);
    page.drawText(draft.admissionNo, { x: cardX + 9, y: cardTop - 27, size: admissionSize, font: bold, color: deepNavy });

    // Status pill
    const statusBg = isEnrolled ? greenWash : wash;
    const statusBorderColor = isEnrolled ? greenBorder : cardBorder;
    const statusColor = isEnrolled ? success : slate;
    page.drawRectangle({
      x: cardX + 8,
      y: cardTop - 45,
      width: cardW - 16,
      height: 14,
      color: statusBg,
      borderColor: statusBorderColor,
      borderWidth: 0.5
    });
    const statusText = `STATUS: ${shortStatus.toUpperCase()}`;
    page.drawText(statusText, {
      x: cardX + 13,
      y: cardTop - 41.5,
      size: fitSize(statusText, bold, 6.3, 5.2, cardW - 26),
      font: bold,
      color: statusColor
    });

    page.drawText(`Issued: ${generatedAt}`, { x: cardX + 9, y: cardTop - 56, size: 6.5, font, color: slate });

    // Title Ribbon
    const ribbonTop = pageH - 114;
    page.drawRectangle({ x: MX, y: ribbonTop - 22, width: CW, height: 22, color: deepNavy });
    page.drawRectangle({ x: MX, y: ribbonTop - 24, width: CW, height: 2, color: gold });
    page.drawText("LEARNER ADMISSION & CBE ENROLMENT DOSSIER", {
      x: MX + 10,
      y: ribbonTop - 15,
      size: 8.6,
      font: bold,
      color: white
    });
    const refWidth = font.widthOfTextAtSize(reference, 7.2);
    page.drawText(reference, { x: pageW - MX - 10 - refWidth, y: ribbonTop - 15, size: 7.2, font, color: lightGold });

    y = ribbonTop - 34;
  };

  const drawContinuationHeader = () => {
    drawPageBorder(page);

    const logoWidth = drawLogo(page, MX, pageH - 32, 24);
    const textX = MX + (logoWidth ? logoWidth + 10 : 0);
    page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", { x: textX, y: pageH - 38, size: 8.2, font: bold, color: deepNavy });
    page.drawText(`Official Admission Dossier  ·  ${reference}  ·  Continued`, { x: textX, y: pageH - 48, size: 6.8, font, color: slate });

    const label = `Page ${pageIndex}`;
    const width = bold.widthOfTextAtSize(label, 7.5);
    page.drawText(label, { x: pageW - MX - width, y: pageH - 40, size: 7.5, font: bold, color: royal });
    page.drawLine({ start: { x: MX, y: pageH - 56 }, end: { x: pageW - MX, y: pageH - 56 }, thickness: 0.6, color: cardBorder });
    page.drawLine({ start: { x: MX, y: pageH - 57.5 }, end: { x: pageW - MX, y: pageH - 57.5 }, thickness: 0.4, color: gold });

    y = pageH - 68;
  };

  const breakPage = () => {
    page = pdf.addPage([pageW, pageH]);
    pageIndex += 1;
    drawContinuationHeader();
  };

  const ensure = (height: number) => {
    if (y - height < CONTENT_FLOOR) breakPage();
  };

  const drawSectionHeader = (number: string, title: string) => {
    ensure(32);
    y -= 8;
    const badgeW = 20;
    const badgeH = 13;
    page.drawRectangle({ x: MX, y: y - 2, width: badgeW, height: badgeH, color: darkRoyal });
    page.drawText(number, {
      x: MX + (badgeW - bold.widthOfTextAtSize(number, 7.5)) / 2,
      y: y + 1.5,
      size: 7.5,
      font: bold,
      color: white
    });

    const titleX = MX + badgeW + 8;
    page.drawText(title.toUpperCase(), { x: titleX, y: y + 1.5, size: 8, font: bold, color: deepNavy });

    const lineStartX = titleX + bold.widthOfTextAtSize(title.toUpperCase(), 8) + 10;
    if (lineStartX < pageW - MX) {
      page.drawLine({ start: { x: lineStartX, y: y + 5 }, end: { x: pageW - MX, y: y + 5 }, thickness: 0.6, color: cardBorder });
    }
    y -= 14;
  };

  const drawFieldCard = (x: number, top: number, width: number, height: number, label: string, entryText: string) => {
    page.drawRectangle({
      x,
      y: top - height,
      width,
      height,
      color: wash,
      borderColor: cardBorder,
      borderWidth: 0.6
    });

    page.drawText(label.toUpperCase(), {
      x: x + 8,
      y: top - 11,
      size: 5.9,
      font: bold,
      color: slate
    });

    const val = value(entryText) || "Not provided";
    const lines = wrap(val, font, 7.8, width - 16);
    let lineY = top - 21.5;
    for (const line of lines.slice(0, 3)) {
      page.drawText(line, {
        x: x + 8,
        y: lineY,
        size: 7.8,
        font: lines.length === 1 && val !== "Not provided" ? bold : font,
        color: deepNavy
      });
      lineY -= 9.5;
    }
  };

  const renderCardGrid = (items: Array<[string, string]>) => {
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i];
      const right = i + 1 < items.length ? items[i + 1] : null;

      const leftVal = value(left[1]) || "Not provided";
      const rightVal = right ? value(right[1]) || "Not provided" : "";
      const leftLines = wrap(leftVal, font, 7.8, COL_W - 16).length;
      const rightLines = right ? wrap(rightVal, font, 7.8, COL_W - 16).length : 1;
      const maxLines = Math.max(leftLines, rightLines);
      const cardH = Math.max(32, 20 + maxLines * 9.5);

      ensure(cardH + 4);

      drawFieldCard(MX, y, COL_W, cardH, left[0], left[1]);
      if (right) {
        drawFieldCard(MX + COL_W + COL_GAP, y, COL_W, cardH, right[0], right[1]);
      }
      y -= cardH + 5;
    }
  };

  const renderFullWidthCard = (label: string, entryText: string) => {
    const val = value(entryText) || "Not provided";
    const lines = wrap(val, font, 7.8, CW - 16);
    const cardH = Math.max(30, 18 + lines.length * 9.5);
    ensure(cardH + 4);

    page.drawRectangle({
      x: MX,
      y: y - cardH,
      width: CW,
      height: cardH,
      color: wash,
      borderColor: cardBorder,
      borderWidth: 0.6
    });

    page.drawText(label.toUpperCase(), {
      x: MX + 8,
      y: y - 10.5,
      size: 5.9,
      font: bold,
      color: slate
    });

    let lineY = y - 21;
    for (const line of lines) {
      page.drawText(line, {
        x: MX + 8,
        y: lineY,
        size: 7.8,
        font,
        color: deepNavy
      });
      lineY -= 9.5;
    }
    y -= cardH + 5;
  };

  const note = (label: string, entry: string) => {
    const content = value(entry);
    if (!content) return;
    renderFullWidthCard(label, content);
  };

  const checkbox = (x: number, bottom: number, checked: boolean) => {
    page.drawRectangle({ x, y: bottom, width: 9, height: 9, borderColor: slate, borderWidth: 0.7, color: white });
    if (!checked) return;
    page.drawRectangle({ x, y: bottom, width: 9, height: 9, color: royal });
    page.drawLine({ start: { x: x + 2.2, y: bottom + 4.8 }, end: { x: x + 4, y: bottom + 2.4 }, thickness: 1.2, color: white });
    page.drawLine({ start: { x: x + 4, y: bottom + 2.4 }, end: { x: x + 7.2, y: bottom + 7 }, thickness: 1.2, color: white });
  };

  const drawSealGraphic = (centerX: number, centerY: number, radius: number) => {
    page.drawCircle({ x: centerX, y: centerY, size: radius, borderColor: darkRoyal, borderWidth: 1.1 });
    page.drawCircle({ x: centerX, y: centerY, size: radius - 2.2, borderColor: gold, borderWidth: 0.5 });
    page.drawCircle({ x: centerX, y: centerY, size: radius - 5.5, borderColor: darkRoyal, borderWidth: 0.5 });

    const badgeW = (radius - 5) * 1.6;
    const badgeH = 13;
    page.drawRectangle({
      x: centerX - badgeW / 2,
      y: centerY - badgeH / 2,
      width: badgeW,
      height: badgeH,
      color: darkRoyal
    });
    page.drawText("APPROVED", {
      x: centerX - 18,
      y: centerY - 3,
      size: 6.8,
      font: bold,
      color: white
    });

    page.drawText("MARY ROYAL SCHOOL", {
      x: centerX - 24,
      y: centerY + 9,
      size: 4.8,
      font: bold,
      color: deepNavy
    });
    page.drawText("OFFICIAL ENROLMENT SEAL", {
      x: centerX - 29,
      y: centerY - 14,
      size: 4.4,
      font: bold,
      color: gold
    });
  };

  drawPageOneHeader();

  // Hero section: Applicant particulars and passport photo
  const heroH = 104;
  ensure(heroH + 8);
  const photoW = 86;
  const photoH = heroH;
  const photoX = pageW - MX - photoW;
  const heroW = CW - photoW - 10;

  // Learner Bio Panel (Left)
  page.drawRectangle({
    x: MX,
    y: y - heroH,
    width: heroW,
    height: heroH,
    color: white,
    borderColor: cardBorder,
    borderWidth: 0.8
  });
  page.drawRectangle({ x: MX, y: y - heroH, width: 3.5, height: heroH, color: royal });

  // Full Name Header
  const applicantName = value(learner?.fullName) || "Applicant Learner";
  const nameSize = fitSize(applicantName, bold, 13, 9.5, heroW - 24);
  page.drawText(applicantName, { x: MX + 12, y: y - 18, size: nameSize, font: bold, color: deepNavy });

  // Prominent Admission Badge
  const admBadgeText = `ADM NO: ${draft.admissionNo}`;
  const admBadgeW = bold.widthOfTextAtSize(admBadgeText, 7.5) + 14;
  page.drawRectangle({
    x: MX + 12,
    y: y - 35,
    width: admBadgeW,
    height: 14,
    color: darkRoyal
  });
  page.drawText(admBadgeText, { x: MX + 19, y: y - 31.5, size: 7.5, font: bold, color: white });

  // Quick-glance metadata grid (4 cells inside bio hero)
  const cellW = (heroW - 24 - 8) / 2;
  const cellH = 26;
  const heroCells = [
    ["GRADE APPLIED", `${value(learner?.grade)}${learner?.stream ? ` (${learner.stream})` : ""}`],
    ["UPI / NEMIS NO", value(learner?.upiNumber) || "Pending MOE Allocation"],
    ["GENDER & DOB", `${value(learner?.gender)} · ${displayDate(learner?.dateOfBirth) || "Not provided"}`],
    ["ADMISSION DATE", displayDate(learner?.admissionDate) || "Recorded"]
  ];

  heroCells.forEach(([cellLabel, entry], idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const cx = MX + 12 + col * (cellW + 8);
    const cy = y - 44 - row * (cellH + 5);
    page.drawRectangle({
      x: cx,
      y: cy - cellH,
      width: cellW,
      height: cellH,
      color: wash,
      borderColor: cardBorder,
      borderWidth: 0.5
    });
    page.drawText(cellLabel, { x: cx + 6, y: cy - 9, size: 5.5, font: bold, color: slate });
    const entrySize = fitSize(entry, bold, 7.2, 5.5, cellW - 12);
    page.drawText(entry, { x: cx + 6, y: cy - 20, size: entrySize, font: bold, color: deepNavy });
  });

  // Photo Box (Right)
  page.drawRectangle({
    x: photoX,
    y: y - photoH,
    width: photoW,
    height: photoH,
    color: white,
    borderColor: cardBorder,
    borderWidth: 0.8
  });

  if (photo) {
    const pad = 3;
    const availW = photoW - pad * 2;
    const availH = photoH - 16 - pad * 2;
    const scale = Math.min(availW / photo.width, availH / photo.height);
    const imgW = photo.width * scale;
    const imgH = photo.height * scale;
    page.drawImage(photo, {
      x: photoX + (photoW - imgW) / 2,
      y: y - photoH + 16 + (availH - imgH) / 2,
      width: imgW,
      height: imgH
    });
    page.drawRectangle({
      x: photoX,
      y: y - photoH,
      width: photoW,
      height: 14,
      color: wash,
      borderColor: cardBorder,
      borderWidth: 0.5
    });
    const photoTag = "OFFICIAL PHOTO";
    page.drawText(photoTag, {
      x: photoX + (photoW - bold.widthOfTextAtSize(photoTag, 5.5)) / 2,
      y: y - photoH + 4.5,
      size: 5.5,
      font: bold,
      color: slate
    });
  } else {
    page.drawRectangle({
      x: photoX + 3,
      y: y - photoH + 3,
      width: photoW - 6,
      height: photoH - 6,
      color: wash,
      borderColor: cardBorder,
      borderWidth: 0.5
    });
    const iconY = y - 44;
    page.drawCircle({ x: photoX + photoW / 2, y: iconY, size: 10, color: rgb(0.85, 0.88, 0.93) });
    page.drawRectangle({
      x: photoX + photoW / 2 - 16,
      y: iconY - 20,
      width: 32,
      height: 12,
      color: rgb(0.85, 0.88, 0.93)
    });
    const photoTag = "PASSPORT PHOTO";
    page.drawText(photoTag, {
      x: photoX + (photoW - bold.widthOfTextAtSize(photoTag, 5.8)) / 2,
      y: y - photoH + 22,
      size: 5.8,
      font: bold,
      color: slate
    });
    const subTag = "Mary Royal Registry";
    page.drawText(subTag, {
      x: photoX + (photoW - font.widthOfTextAtSize(subTag, 5)) / 2,
      y: y - photoH + 12,
      size: 5,
      font,
      color: slate
    });
  }

  y -= heroH + 8;

  // Section 01: Applicant Demographics & Educational Background
  drawSectionHeader("01", "Learner Identification & CBE Placement");
  renderCardGrid([
    ["Grade Applied", value(learner?.grade)],
    ["Stream Allocation", value(learner?.stream) || "Default Stream"],
    ["Admission Date", displayDate(learner?.admissionDate)],
    ["Nationality", value(learner?.nationality) || "Kenyan"],
    ["Religion", value(learner?.religion) || "Not provided"],
    ["Languages Spoken", (learner?.languagesSpoken ?? []).join(", ") || "English, Kiswahili"],
    ["Previous School Attended", value(learner?.previousSchool) || "Not provided"],
    ["Previous Class Completed", value(learner?.previousClass) || "Not provided"]
  ]);

  if (learner?.reasonForLeaving) {
    renderFullWidthCard("Reason for leaving previous school", learner.reasonForLeaving);
  }

  // Section 02: Residence & Commute
  drawSectionHeader("02", "Residential Address & Commute Particulars");
  const residence = data.residence;
  renderCardGrid([
    ["County", value(residence?.county)],
    ["Sub-County", value(residence?.subCounty)],
    ["Ward", value(residence?.ward)],
    ["Village / Estate / Area", value(residence?.village)],
    [
      "Distance to School",
      residence?.distanceToSchoolKm !== null && residence?.distanceToSchoolKm !== undefined
        ? `${residence.distanceToSchoolKm} km`
        : ""
    ],
    ["Means of Commute", value(residence?.transportMeans)]
  ]);

  if (residence?.physicalAddress || residence?.landmark) {
    const fullAddress = [
      value(residence?.physicalAddress),
      residence?.landmark ? `Nearest Landmark: ${residence.landmark}` : ""
    ].filter(Boolean).join(" · ");
    renderFullWidthCard("Physical Residential Address & Landmark", fullAddress);
  }

  // Section 03: Parents & Legal Guardians
  drawSectionHeader("03", "Parents & Authorized Legal Guardians");
  const guardians = data.guardians ?? [];
  if (!guardians.length) {
    renderCardGrid([["Guardian Details", "Not provided"]]);
  } else {
    guardians.forEach((guardian, index) => {
      const isPrimary = guardian.primaryContact;
      const subtitle = `Guardian ${index + 1}: ${value(guardian.fullName)} (${value(guardian.relationship)})${isPrimary ? " · PRIMARY CONTACT & SPONSOR" : ""}`;
      ensure(16);
      page.drawText(subtitle.toUpperCase(), { x: MX, y: y - 2, size: 7.2, font: bold, color: isPrimary ? darkRoyal : slate });
      y -= 10;
      renderCardGrid([
        ["Full Legal Name", value(guardian.fullName)],
        ["Relationship to Learner", value(guardian.relationship)],
        ["Primary Telephone", value(guardian.phone)],
        ["Alternate Telephone", value(guardian.alternatePhone)],
        ["Email Address", value(guardian.email)],
        ["National ID / Passport", value(guardian.idNumber)],
        ["Occupation", value(guardian.occupation)],
        ["Employer / Business", value(guardian.employer)],
        ["Fees Responsibility", guardian.paysFees ? "Yes - Responsible for school fees" : "No"],
        ["Home Address", value(guardian.homeAddress)]
      ]);
    });
  }

  // Section 04: Emergency Contacts & Authorized Pickup
  drawSectionHeader("04", "Emergency Contacts & Authorized Pickup");
  const emergencyContacts = data.emergencyContacts ?? [];
  const emergencyPairs: Array<[string, string]> = [];

  if (emergencyContacts.length) {
    emergencyContacts.forEach((contact, idx) => {
      emergencyPairs.push([`Emergency Contact ${idx + 1}`, `${value(contact.fullName)} (${value(contact.relationship)}) - Tel: ${value(contact.phone)}`]);
    });
  } else {
    emergencyPairs.push(["Emergency Contact", "Not provided"]);
  }

  const pickupPersons = data.pickupPersons ?? [];
  if (pickupPersons.length) {
    pickupPersons.forEach((person, idx) => {
      emergencyPairs.push([`Authorized Collector ${idx + 1}`, `${value(person.fullName)} (${value(person.relationship)}) - Tel: ${value(person.phone)}`]);
    });
  }

  renderCardGrid(emergencyPairs);

  // Section 05: Health & Medical Declaration (Restricted)
  drawSectionHeader("05", "Health & Medical Information (Confidential)");
  ensure(16);
  page.drawText("CONFIDENTIAL · RESTRICTED TO AUTHORIZED SCHOOL LEADERS AND CLASS TEACHER", {
    x: MX,
    y: y - 2,
    size: 6.5,
    font: bold,
    color: darkRoyal
  });
  y -= 10;

  const health = data.health;
  renderCardGrid([
    ["Blood Group", value(health?.bloodGroup)],
    ["Immunisation Status", value(health?.immunizationStatus)],
    ["Preferred Hospital / Doctor", value(health?.doctorOrHospital)],
    ["Health Insurance Provider", value(health?.healthInsurance)]
  ]);
  note("Known Medical Conditions", value(health?.knownConditions));
  note("Allergies & Sensitivities", value(health?.allergies));
  note("Current Medication", value(health?.currentMedication));
  note("Special Educational Needs / Disabilities", value(health?.specialNeeds));

  // Section 06: Fee Handoff & Optional Services
  drawSectionHeader("06", "Fee Handoff & Optional Services");
  renderCardGrid([
    ["Admission Term", value(data.fee?.term)],
    ["Responsible Fee Payer", value(data.fee?.feePayerGuardian)],
    ["Optional Services Requested", (data.fee?.requestedOptionalItems ?? []).join(", ") || "None requested"],
    ["Data Protection Consent", data.consent ? "Granted - Kenya Data Protection Act 2019" : "Not recorded"]
  ]);
  note("Accountant Handoff Note", value(data.fee?.handoffNote));

  // Section 07: Verified Document Checklist
  drawSectionHeader("07", "Verified Admission Document Checklist");
  const documentEntries = Object.entries(admissionDocumentCategoryLabels);
  const checklistColW = CW / 2;
  for (let index = 0; index < documentEntries.length; index += 2) {
    ensure(18);
    for (let column = 0; column < 2 && index + column < documentEntries.length; column += 1) {
      const [category, docLabel] = documentEntries[index + column];
      const uploaded = draft.documents.some((document) => document.category === category);
      const cx = MX + column * checklistColW;
      checkbox(cx + 1, y - 9, uploaded);
      const mandatory = category === "PASSPORT_PHOTO" || category === "BIRTH_CERTIFICATE" ? " (mandatory)" : "";
      const labelText = `${docLabel}${mandatory}`;
      page.drawText(labelText, {
        x: cx + 15,
        y: y - 8.5,
        size: fitSize(labelText, font, 7.5, 5.8, checklistColW - 68),
        font,
        color: uploaded ? deepNavy : slate
      });
      if (uploaded) {
        page.drawText("Received", { x: cx + checklistColW - 46, y: y - 8.5, size: 6.2, font: bold, color: success });
      }
    }
    y -= 16;
  }
  y -= 4;

  // Section 08: Record Audit & History
  drawSectionHeader("08", "Admission Packet Audit & History");
  renderCardGrid([
    ["Record Created", displayDateTime(draft.createdAt)],
    ["Submitted For Approval", displayDateTime(draft.submittedAt)],
    ["Enrolment Confirmed", displayDateTime(draft.enrolledAt ?? draft.learner?.admissionApprovedAt ?? null)],
    ["Last Updated", displayDateTime(draft.updatedAt)],
    ["Issued By Role", ROLE_LABELS[user.role] ?? user.role],
    ["Document Security Ref", reference]
  ]);

  // Section 09: Declaration & Institutional Endorsement
  const declaration =
    "The parent or legal guardian confirms that the information furnished in this admission dossier is true, complete, and accurate. The school confirms receipt of the admission documents listed above. Final enrolment is subject to Head Teacher approval and official registration under the Kenya Basic Education Act and CBC/CBE guidelines.";
  const declarationLines = wrap(declaration, font, 7.3, CW);
  const cardHeight = 62;
  const panelHeight = 56;

  ensure(declarationLines.length * 9.5 + cardHeight + panelHeight + 64);
  drawSectionHeader("09", "Declarations & Institutional Endorsement");

  for (const item of declarationLines) {
    page.drawText(item, { x: MX, y, size: 7.3, font, color: deepNavy });
    y -= 9.5;
  }
  y -= 10;

  // 3 Signature & Seal blocks
  const sigGap = 10;
  const sigW = (CW - sigGap * 2) / 3;
  ensure(cardHeight + 8);

  // Box 1: Parent
  const b1X = MX;
  page.drawRectangle({ x: b1X, y: y - cardHeight, width: sigW, height: cardHeight, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawText("PARENT / LEGAL GUARDIAN", { x: b1X + 8, y: y - 12, size: 6.4, font: bold, color: deepNavy });
  page.drawLine({ start: { x: b1X + 8, y: y - cardHeight + 22 }, end: { x: b1X + sigW - 8, y: y - cardHeight + 22 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Signature & Date", { x: b1X + 8, y: y - cardHeight + 11, size: 5.8, font, color: slate });

  // Box 2: Admissions Secretary
  const b2X = MX + sigW + sigGap;
  page.drawRectangle({ x: b2X, y: y - cardHeight, width: sigW, height: cardHeight, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawText("ADMISSIONS SECRETARY", { x: b2X + 8, y: y - 12, size: 6.4, font: bold, color: deepNavy });
  page.drawLine({ start: { x: b2X + 8, y: y - cardHeight + 22 }, end: { x: b2X + sigW - 8, y: y - cardHeight + 22 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Verified & Duly Cleared", { x: b2X + 8, y: y - cardHeight + 11, size: 5.8, font, color: slate });

  // Box 3: Head Teacher / Director with Official School Seal
  const b3X = MX + (sigW + sigGap) * 2;
  page.drawRectangle({ x: b3X, y: y - cardHeight, width: sigW, height: cardHeight, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawText("HEAD TEACHER / DIRECTOR", { x: b3X + 8, y: y - 12, size: 6.4, font: bold, color: deepNavy });

  drawSealGraphic(b3X + sigW - 28, y - cardHeight + 28, 22);

  page.drawLine({ start: { x: b3X + 8, y: y - cardHeight + 22 }, end: { x: b3X + sigW - 56, y: y - cardHeight + 22 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Official Approval & Seal", { x: b3X + 8, y: y - cardHeight + 11, size: 5.8, font, color: slate });

  y -= cardHeight + 10;

  // Section 10: QR Code Verification
  ensure(panelHeight + 6);
  page.drawRectangle({ x: MX, y: y - panelHeight, width: CW, height: panelHeight, color: wash, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawRectangle({ x: MX, y: y - panelHeight, width: 3, height: panelHeight, color: royal });

  let qrWidth = 0;
  try {
    const qrData = `MARY_ROYAL_ADMISSION:${draft.id}:${draft.admissionNo}:${value(learner?.fullName) || "Learner"}:${draft.status}`;
    const matrix = generateQrMatrix(qrData);
    const size = 40;
    const pixel = size / matrix.length;
    const qrX = MX + 10;
    const qrY = y - panelHeight + 8;
    for (let row = 0; row < matrix.length; row += 1) {
      for (let column = 0; column < matrix[row].length; column += 1) {
        if (matrix[row][column]) {
          page.drawRectangle({
            x: qrX + column * pixel,
            y: qrY + (matrix.length - 1 - row) * pixel,
            width: pixel,
            height: pixel,
            color: deepNavy
          });
        }
      }
    }
    qrWidth = size + 12;
  } catch {
    qrWidth = 0;
  }

  const textX = MX + 10 + qrWidth;
  const textWidth = CW - (textX - MX) - 10;
  page.drawText("INSTITUTIONAL DOCUMENT VERIFICATION", { x: textX, y: y - 14, size: 6.3, font: bold, color: royal });
  const verifyNotice = "Scan the QR code or present reference MR-ADM to Mary Royal School registry to verify official admission dossier.";
  for (const [idx, item] of wrap(verifyNotice, font, 7, textWidth).slice(0, 2).entries()) {
    page.drawText(item, { x: textX, y: y - 25 - idx * 8.8, size: 7, font, color: deepNavy });
  }
  const verifyLine = `Ref: ${reference}  ·  Status: ${shortStatus}  ·  Issued: ${generatedAt}  ·  Auth: ${ROLE_LABELS[user.role] ?? user.role}`;
  page.drawText(verifyLine, {
    x: textX,
    y: y - 45,
    size: fitSize(verifyLine, font, 6.4, 5.2, textWidth),
    font,
    color: slate
  });
  y -= panelHeight;

  // Running page footer on each page
  const totalPages = pdf.getPageCount();
  for (let idx = 0; idx < totalPages; idx += 1) {
    const footerPage = pdf.getPage(idx);
    footerPage.drawLine({ start: { x: MX, y: 38 }, end: { x: pageW - MX, y: 38 }, thickness: 0.5, color: cardBorder });
    footerPage.drawText(`Mary Royal Primary & Junior School · Obunga, Kisumu · Official Enrolment Record`, {
      x: MX,
      y: 28,
      size: 6.2,
      font,
      color: slate
    });
    const right = `Page ${idx + 1} of ${totalPages} · ${reference} · ${generatedStamp} EAT`;
    const rightWidth = font.widthOfTextAtSize(right, 6.2);
    footerPage.drawText(right, { x: pageW - MX - rightWidth, y: 28, size: 6.2, font, color: slate });
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

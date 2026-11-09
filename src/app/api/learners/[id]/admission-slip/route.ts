import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { canInScope } from "@/lib/permissions";
import { readSession } from "@/lib/session";
import { admissionDraftDataSchema, type AdmissionDraftData } from "@/lib/admissions";
import { readStoredFile } from "@/lib/file-storage";
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
      admissionDraft: {
        include: {
          documents: {
            where: { category: "PASSPORT_PHOTO" },
            take: 1
          }
        }
      },
      guardians: {
        include: { user: { select: { id: true, name: true, phone: true, email: true } } }
      }
    }
  });

  if (!learner) return NextResponse.json({ error: "Learner record not found." }, { status: 404 });

  if (!schoolScope) {
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
  const greenText = rgb(0.086, 0.45, 0.22);
  const greenWash = rgb(0.92, 0.97, 0.94);
  const greenBorder = rgb(0.74, 0.89, 0.78);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Admission Slip ${learner.admissionNo} - ${value(learner.name)} - Mary Royal School`);
  pdf.setAuthor("Mary Royal Primary & Junior School, Obunga, Kisumu");
  pdf.setSubject("Official learner admission slip and enrolment record");

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

  // Load applicant passport photo if available
  let photo: PDFImage | null = null;
  const attachedPhoto = learner.admissionDraft?.documents[0];
  if (
    attachedPhoto &&
    attachedPhoto.contentType !== "application/pdf" &&
    /^[a-f0-9-]{36}\.(jpg|png)$/.test(attachedPhoto.storageKey) &&
    learner.admissionDraft
  ) {
    try {
      const bytes = await readStoredFile("private", `admissions/${learner.admissionDraft.id}/${attachedPhoto.storageKey}`);
      photo = attachedPhoto.contentType === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    } catch {
      photo = null;
    }
  }

  const reference = `MR-SLIP/${learner.admissionNo}`;
  const status = STATUS_LABELS[learner.admissionStatus] ?? (value(learner.admissionStatus) || "Recorded");
  const isEnrolled = learner.admissionStatus === "APPROVED";
  const generatedAt = displayDate(new Date().toISOString().slice(0, 10));
  const generatedStamp = displayDateTime(new Date());

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

    page.drawText("OFFICIAL ADMISSION SLIP", { x: cardX + 9, y: cardTop - 13, size: 6.5, font: bold, color: royal });
    const admissionSize = fitSize(pdfText(learner.admissionNo), bold, 11, 7.5, cardW - 18);
    page.drawText(pdfText(learner.admissionNo), { x: cardX + 9, y: cardTop - 27, size: admissionSize, font: bold, color: deepNavy });

    // Status pill
    const statusBg = isEnrolled ? greenWash : wash;
    const statusBorderColor = isEnrolled ? greenBorder : cardBorder;
    const statusColor = isEnrolled ? greenText : slate;
    page.drawRectangle({
      x: cardX + 8,
      y: cardTop - 45,
      width: cardW - 16,
      height: 14,
      color: statusBg,
      borderColor: statusBorderColor,
      borderWidth: 0.5
    });
    const statusText = `STATUS: ${status.toUpperCase()}`;
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
    page.drawText("OFFICIAL LEARNER ADMISSION SLIP & ENROLMENT CERTIFICATE", {
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
    page.drawText(`Official Admission Slip  ·  ${reference}  ·  Continued`, { x: textX, y: pageH - 48, size: 6.8, font, color: slate });

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

  // Draws a crisp card for a field
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

    // Label
    page.drawText(label.toUpperCase(), {
      x: x + 8,
      y: top - 11,
      size: 5.9,
      font: bold,
      color: slate
    });

    // Content value
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

  // Draws structured 2-column card pairs
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

  // Draws a full-width card for wide items (e.g., physical address, reason for leaving)
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

  // Draws an official circular seal stamp graphic
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

  // Hero section: Student particulars and passport photo
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
  const learnerName = value(learner.name);
  const nameSize = fitSize(learnerName, bold, 13, 9.5, heroW - 24);
  page.drawText(learnerName, { x: MX + 12, y: y - 18, size: nameSize, font: bold, color: deepNavy });

  // Prominent Admission Badge
  const admBadgeText = `ADM NO: ${pdfText(learner.admissionNo)}`;
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
  const admissionDate = profile?.admissionDate ?? learner.admissionApprovedAt ?? null;
  const heroCells = [
    ["GRADE / CLASS", `${value(learner.grade)}${profile?.stream || draftLearner.stream ? ` (${profile?.stream ?? draftLearner.stream})` : ""}`],
    ["UPI / NEMIS NO", value(profile?.upiNumber ?? draftLearner.upiNumber) || "Pending MOE Allocation"],
    ["GENDER & DOB", `${value(learner.gender)} · ${displayDate(profile?.dateOfBirth) || displayDate(draftLearner.dateOfBirth) || "Not provided"}`],
    ["ADMISSION DATE", displayDate(admissionDate) || displayDate(draftLearner.admissionDate) || "Recorded"]
  ];

  heroCells.forEach(([label, entry], idx) => {
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
    page.drawText(label, { x: cx + 6, y: cy - 9, size: 5.5, font: bold, color: slate });
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
    // Elegant passport placeholder
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

  // Section 01: Enrolment Details & CBE Placement
  drawSectionHeader("01", "Enrolment Details & CBE Placement");
  renderCardGrid([
    ["Grade / Class", value(learner.grade)],
    ["Stream Allocation", profile?.stream ?? draftLearner.stream ?? "Default Stream"],
    ["Enrolment Date", displayDate(admissionDate) || displayDate(draftLearner.admissionDate)],
    ["Enrolment Confirmed", displayDateTime(learner.admissionApprovedAt) || "Recorded"],
    ["Curriculum Pathway", "Kenya Competency Based Curriculum (CBC / CBE)"],
    ["Nationality", profile?.nationality ?? draftLearner.nationality ?? "Kenyan"],
    ["Previous School Attended", profile?.previousSchool ?? draftLearner.previousSchool ?? ""],
    ["Last Class Completed", profile?.previousClass ?? draftLearner.previousClass ?? ""]
  ]);

  if (profile?.reasonForLeaving || draftLearner.reasonForLeaving) {
    renderFullWidthCard("Reason for leaving previous school", profile?.reasonForLeaving ?? draftLearner.reasonForLeaving ?? "");
  }

  // Section 02: Residence & Commute
  drawSectionHeader("02", "Residential Address & Commute Particulars");
  renderCardGrid([
    ["County", profile?.county ?? draftResidence.county ?? ""],
    ["Sub-County", profile?.subCounty ?? draftResidence.subCounty ?? ""],
    ["Ward", profile?.ward ?? draftResidence.ward ?? ""],
    ["Village / Estate / Area", profile?.village ?? draftResidence.village ?? ""],
    [
      "Distance to School",
      profile?.distanceToSchoolKm !== null && profile?.distanceToSchoolKm !== undefined
        ? `${profile.distanceToSchoolKm} km`
        : draftResidence.distanceToSchoolKm !== null && draftResidence.distanceToSchoolKm !== undefined
          ? `${draftResidence.distanceToSchoolKm} km`
          : ""
    ],
    ["Means of Commute", profile?.transportMeans ?? draftResidence.transportMeans ?? ""]
  ]);

  if (profile?.physicalAddress || draftResidence.physicalAddress || profile?.landmark || draftResidence.landmark) {
    const fullAddress = [
      profile?.physicalAddress ?? draftResidence.physicalAddress ?? "",
      profile?.landmark || draftResidence.landmark ? `Nearest Landmark: ${profile?.landmark ?? draftResidence.landmark}` : ""
    ].filter(Boolean).join(" · ");
    renderFullWidthCard("Physical Residential Address & Landmark", fullAddress);
  }

  // Section 03: Parents & Authorized Legal Guardians
  drawSectionHeader("03", "Parents & Authorized Legal Guardians");
  const profileGuardians = profile?.guardians ?? [];
  const draftGuardians = data.guardians ?? [];
  const portalGuardians = learner.guardians;

  if (profileGuardians.length) {
    profileGuardians.forEach((guardian, index) => {
      const isPrimary = guardian.primaryContact;
      const subtitle = `Guardian ${index + 1}: ${guardian.fullName} (${guardian.relationship})${isPrimary ? " · PRIMARY CONTACT & SPONSOR" : ""}`;
      ensure(16);
      page.drawText(subtitle.toUpperCase(), { x: MX, y: y - 2, size: 7.2, font: bold, color: isPrimary ? darkRoyal : slate });
      y -= 10;
      renderCardGrid([
        ["Full Legal Name", guardian.fullName],
        ["Relationship to Learner", guardian.relationship],
        ["Primary Telephone", guardian.phone],
        ["Alternate Telephone", guardian.alternatePhone ?? ""],
        ["Email Address", guardian.email ?? ""],
        ["National ID / Passport", guardian.idNumber ?? ""],
        ["Occupation", guardian.occupation ?? ""],
        ["Employer / Business", guardian.employer ?? ""],
        ["Fees Responsibility", guardian.paysFees ? "Yes - Responsible for school fees" : "No"],
        ["Home Address", guardian.homeAddress ?? ""]
      ]);
    });
  } else if (draftGuardians.length) {
    draftGuardians.forEach((guardian, index) => {
      const isPrimary = guardian.primaryContact;
      const subtitle = `Guardian ${index + 1}: ${value(guardian.fullName)} (${value(guardian.relationship)})${isPrimary ? " · PRIMARY CONTACT & SPONSOR" : ""}`;
      ensure(16);
      page.drawText(subtitle.toUpperCase(), { x: MX, y: y - 2, size: 7.2, font: bold, color: isPrimary ? darkRoyal : slate });
      y -= 10;
      renderCardGrid([
        ["Full Legal Name", guardian.fullName ?? ""],
        ["Relationship to Learner", guardian.relationship ?? ""],
        ["Primary Telephone", guardian.phone ?? ""],
        ["Alternate Telephone", guardian.alternatePhone ?? ""],
        ["Email Address", guardian.email ?? ""],
        ["National ID / Passport", guardian.idNumber ?? ""],
        ["Occupation", guardian.occupation ?? ""],
        ["Employer / Business", guardian.employer ?? ""],
        ["Fees Responsibility", guardian.paysFees ? "Yes - Responsible for school fees" : "No"],
        ["Home Address", guardian.homeAddress ?? ""]
      ]);
    });
  } else if (portalGuardians.length) {
    portalGuardians.forEach((link, index) => {
      ensure(16);
      page.drawText(`GUARDIAN ${index + 1}: ${link.user.name} (${link.relation})`.toUpperCase(), { x: MX, y: y - 2, size: 7.2, font: bold, color: darkRoyal });
      y -= 10;
      renderCardGrid([
        ["Full Legal Name", link.user.name],
        ["Relationship to Learner", link.relation],
        ["Primary Telephone", link.user.phone ?? ""],
        ["Email Address", link.user.email ?? ""]
      ]);
    });
  } else {
    renderCardGrid([["Registered Guardian", "Not provided"]]);
  }

  // Section 04: Emergency Contacts & Authorized Pickup
  drawSectionHeader("04", "Emergency Contacts & Authorized Pickup");
  const emergencyContacts = profile?.emergencyContacts ?? [];
  const draftEmergency = data.emergencyContacts ?? [];
  const emergencyPairs: Array<[string, string]> = [];

  if (emergencyContacts.length) {
    emergencyContacts.forEach((contact, idx) => {
      emergencyPairs.push([`Emergency Contact ${idx + 1}`, `${contact.fullName} (${contact.relationship}) - Tel: ${contact.phone}`]);
    });
  } else if (draftEmergency.length) {
    draftEmergency.forEach((contact, idx) => {
      emergencyPairs.push([`Emergency Contact ${idx + 1}`, `${value(contact.fullName)} (${value(contact.relationship)}) - Tel: ${value(contact.phone)}`]);
    });
  } else {
    emergencyPairs.push(["Emergency Contact", "Not provided"]);
  }

  const pickupPersons = profile?.pickupPersons ?? [];
  const draftPickup = data.pickupPersons ?? [];
  if (pickupPersons.length) {
    pickupPersons.forEach((person, idx) => {
      emergencyPairs.push([`Authorized Collector ${idx + 1}`, `${person.fullName} (${person.relationship}) - Tel: ${person.phone}`]);
    });
  } else if (draftPickup.length) {
    draftPickup.forEach((person, idx) => {
      emergencyPairs.push([`Authorized Collector ${idx + 1}`, `${value(person.fullName)} (${value(person.relationship)}) - Tel: ${value(person.phone)}`]);
    });
  }

  renderCardGrid(emergencyPairs);

  // Section 05: Official Undertaking & Endorsement
  const declaration =
    "The parent or legal guardian confirms that the information furnished on this admission slip is true, complete, and accurate, and undertakes to notify the school immediately of any material change. The learner is admitted subject to Mary Royal School regulations, the Basic Education Act, and continuous assessment under the Kenya Competency Based Curriculum (CBC / CBE). Personal data is protected in accordance with the Kenya Data Protection Act 2019.";
  const declarationLines = wrap(declaration, font, 7.3, CW);
  const signatureHeight = 62;
  const panelHeight = 56;
  const consentAt = profile?.consentAt ?? null;
  const consentLine = data.consent || consentAt
    ? `Data protection consent: Granted & Logged in School Registry${consentAt ? ` on ${displayDate(consentAt.toISOString().slice(0, 10))}` : ""}`
    : "Data protection consent: Not recorded";

  ensure(declarationLines.length * 9.5 + signatureHeight + panelHeight + 64);
  drawSectionHeader("05", "Declaration & Institutional Endorsement");

  for (const item of declarationLines) {
    page.drawText(item, { x: MX, y, size: 7.3, font, color: deepNavy });
    y -= 9.5;
  }
  y -= 3;
  page.drawText(consentLine, { x: MX, y, size: 6.8, font: bold, color: darkRoyal });
  y -= 12;

  // 3 Signature & Seal blocks
  const sigGap = 10;
  const sigW = (CW - sigGap * 2) / 3;
  ensure(signatureHeight + 8);

  // Box 1: Parent / Guardian
  const b1X = MX;
  page.drawRectangle({ x: b1X, y: y - signatureHeight, width: sigW, height: signatureHeight, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawText("PARENT / LEGAL GUARDIAN", { x: b1X + 8, y: y - 12, size: 6.4, font: bold, color: deepNavy });
  page.drawLine({ start: { x: b1X + 8, y: y - signatureHeight + 22 }, end: { x: b1X + sigW - 8, y: y - signatureHeight + 22 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Signature & Date", { x: b1X + 8, y: y - signatureHeight + 11, size: 5.8, font, color: slate });

  // Box 2: Admissions Secretary
  const b2X = MX + sigW + sigGap;
  page.drawRectangle({ x: b2X, y: y - signatureHeight, width: sigW, height: signatureHeight, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawText("ADMISSIONS SECRETARY", { x: b2X + 8, y: y - 12, size: 6.4, font: bold, color: deepNavy });
  page.drawLine({ start: { x: b2X + 8, y: y - signatureHeight + 22 }, end: { x: b2X + sigW - 8, y: y - signatureHeight + 22 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Verified & Duly Cleared", { x: b2X + 8, y: y - signatureHeight + 11, size: 5.8, font, color: slate });

  // Box 3: Head Teacher / Director with Official School Seal
  const b3X = MX + (sigW + sigGap) * 2;
  page.drawRectangle({ x: b3X, y: y - signatureHeight, width: sigW, height: signatureHeight, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawText("HEAD TEACHER / DIRECTOR", { x: b3X + 8, y: y - 12, size: 6.4, font: bold, color: deepNavy });

  // Draw authentic seal stamp graphic inside Box 3
  drawSealGraphic(b3X + sigW - 28, y - signatureHeight + 28, 22);

  page.drawLine({ start: { x: b3X + 8, y: y - signatureHeight + 22 }, end: { x: b3X + sigW - 56, y: y - signatureHeight + 22 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Official Approval & Seal", { x: b3X + 8, y: y - signatureHeight + 11, size: 5.8, font, color: slate });

  y -= signatureHeight + 10;

  // Document Security & QR Verification Box
  ensure(panelHeight + 6);
  page.drawRectangle({ x: MX, y: y - panelHeight, width: CW, height: panelHeight, color: wash, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawRectangle({ x: MX, y: y - panelHeight, width: 3, height: panelHeight, color: royal });

  let qrWidth = 0;
  try {
    const qrData = `MARY_ROYAL_ADMISSION_SLIP:${learner.id}:${learner.admissionNo}:${value(learner.name)}:${learner.grade}:${learner.admissionStatus}`;
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
  const verifyNotice = "Scan the QR code or present reference MR-SLIP to Mary Royal School registry to verify official learner enrolment.";
  for (const [idx, item] of wrap(verifyNotice, font, 7, textWidth).slice(0, 2).entries()) {
    page.drawText(item, { x: textX, y: y - 25 - idx * 8.8, size: 7, font, color: deepNavy });
  }
  const verifyLine = `Ref: ${reference}  ·  Status: ${status}  ·  Issued: ${generatedAt}  ·  Authorized by: ${ROLE_LABELS[user.role] ?? value(user.role)}`;
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
    footerPage.drawText("Mary Royal Primary & Junior School  ·  Obunga, Kisumu  ·  Official Enrolment Record  ·  This slip is not a fee receipt.", {
      x: MX,
      y: 28,
      size: 6.2,
      font,
      color: slate
    });
    const right = `Page ${idx + 1} of ${totalPages}  ·  ${reference}  ·  ${generatedStamp} EAT`;
    const rightWidth = font.widthOfTextAtSize(right, 6.2);
    footerPage.drawText(right, { x: pageW - MX - rightWidth, y: 28, size: 6.2, font, color: slate });
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

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
  const data   = parsed.success ? parsed.data : {};

  // ── Colour palette ──────────────────────────────────────────────────────────
  const deepNavy   = rgb(0.027, 0.071, 0.141);
  const royal      = rgb(0.114, 0.306, 0.847);
  const darkRoyal  = rgb(0.086, 0.22,  0.58);
  const gold       = rgb(0.78,  0.6,   0.17);
  const lightGold  = rgb(0.96,  0.92,  0.82);
  const slate      = rgb(0.357, 0.42,  0.51);
  const wash       = rgb(0.965, 0.976, 0.992);
  const cardBorder = rgb(0.855, 0.886, 0.933);
  const white      = rgb(1, 1, 1);
  const success    = rgb(0.055, 0.478, 0.235);
  const greenWash  = rgb(0.92,  0.97,  0.94);
  const greenBorder = rgb(0.74, 0.89,  0.78);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Admission Dossier ${draft.admissionNo} - Mary Royal School`);
  pdf.setAuthor("Mary Royal Primary & Junior School, Obunga, Kisumu");
  pdf.setSubject("Official learner admission and CBE enrolment record");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.28;
  const pageH = 841.89;
  const MX    = 32;
  const CW    = pageW - MX * 2;
  const CONTENT_FLOOR = 60;
  const COL_GAP = 7;
  const COL_W   = (CW - COL_GAP) / 2;

  // ── Load logo ───────────────────────────────────────────────────────────────
  let logo: PDFImage | null = null;
  try {
    const bytes = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
    logo = await pdf.embedPng(bytes);
  } catch {
    logo = null;
  }

  // ── Load applicant photo ────────────────────────────────────────────────────
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
    day: "2-digit", month: "short", year: "numeric", timeZone: "Africa/Nairobi"
  }).format(new Date());

  const generatedStamp = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi"
  }).format(new Date());

  const shortStatus = SHORT_STATUS[draft.status] ?? draft.status;
  const isEnrolled  = draft.status === "ENROLLED" || draft.status === "APPROVED";
  const reference   = `MR-ADM/${draft.admissionNo}`;
  const learner     = data.learner;

  // ── Multi-page support ──────────────────────────────────────────────────────
  let page: PDFPage = pdf.addPage([pageW, pageH]);
  let pageIndex = 1;
  let y = 0;

  // ── Page border helper ──────────────────────────────────────────────────────
  const drawPageBorder = (p: PDFPage) => {
    p.drawRectangle({ x: 14, y: 14, width: pageW - 28, height: pageH - 28, borderColor: royal, borderWidth: 1 });
    p.drawRectangle({ x: 17, y: 17, width: pageW - 34, height: pageH - 34, borderColor: gold,  borderWidth: 0.4 });
    const cs = 5;
    for (const c of [
      { x: 13,                    y: 13 },
      { x: pageW - 14 - cs,       y: 13 },
      { x: 13,                    y: pageH - 14 - cs },
      { x: pageW - 14 - cs,       y: pageH - 14 - cs }
    ]) {
      p.drawRectangle({ x: c.x, y: c.y, width: cs, height: cs, color: royal });
      p.drawRectangle({ x: c.x + 1, y: c.y + 1, width: cs - 2, height: cs - 2, color: gold });
    }
  };

  // ── Draw logo helper ────────────────────────────────────────────────────────
  const drawLogo = (p: PDFPage, lx: number, top: number, maxSize: number) => {
    if (logo) {
      const scale = Math.min(maxSize / logo.width, maxSize / logo.height);
      const lW    = logo.width  * scale;
      const lH    = logo.height * scale;
      p.drawImage(logo, { x: lx, y: top - lH, width: lW, height: lH });
      return lW;
    }
    p.drawRectangle({ x: lx, y: top - maxSize, width: maxSize, height: maxSize, color: royal });
    p.drawRectangle({ x: lx + 2.5, y: top - maxSize + 2.5, width: maxSize - 5, height: maxSize - 5, borderColor: gold, borderWidth: 0.8 });
    p.drawText("MR", {
      x: lx + maxSize / 2 - maxSize * 0.19,
      y: top - maxSize / 2 - maxSize * 0.13,
      size: maxSize * 0.36, font: bold, color: white
    });
    return maxSize;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1 HEADER — centered masthead
  // ═══════════════════════════════════════════════════════════════════════════
  const drawPageOneHeader = () => {
    drawPageBorder(page);

    const HEADER_TOP = pageH - 24;

    // Top decorative bar
    page.drawRectangle({ x: MX, y: HEADER_TOP - 4, width: CW, height: 4, color: royal });
    page.drawRectangle({ x: MX, y: HEADER_TOP - 5.5, width: CW, height: 1.5, color: gold });

    // Centered logo
    const LOGO_SIZE = 56;
    const logoTop   = HEADER_TOP - 10;
    if (logo) {
      const scale = Math.min(LOGO_SIZE / logo.width, LOGO_SIZE / logo.height);
      const lW    = logo.width  * scale;
      const lH    = logo.height * scale;
      page.drawImage(logo, { x: pageW / 2 - lW / 2, y: logoTop - lH, width: lW, height: lH });
    } else {
      page.drawRectangle({ x: pageW / 2 - LOGO_SIZE / 2, y: logoTop - LOGO_SIZE, width: LOGO_SIZE, height: LOGO_SIZE, color: royal });
      page.drawRectangle({ x: pageW / 2 - LOGO_SIZE / 2 + 2.5, y: logoTop - LOGO_SIZE + 2.5, width: LOGO_SIZE - 5, height: LOGO_SIZE - 5, borderColor: gold, borderWidth: 0.8 });
      page.drawText("MR", {
        x: pageW / 2 - bold.widthOfTextAtSize("MR", LOGO_SIZE * 0.36) / 2,
        y: logoTop - LOGO_SIZE / 2 - LOGO_SIZE * 0.1,
        size: LOGO_SIZE * 0.36, font: bold, color: white
      });
    }

    // School name centered
    const schoolName     = "MARY ROYAL PRIMARY & JUNIOR SCHOOL";
    const schoolNameSize = fitSize(schoolName, bold, 15, 10, CW);
    page.drawText(schoolName, {
      x: pageW / 2 - bold.widthOfTextAtSize(schoolName, schoolNameSize) / 2,
      y: logoTop - LOGO_SIZE - 11,
      size: schoolNameSize, font: bold, color: deepNavy
    });

    // Motto centered
    const motto     = '"Hard Work Pays - Nurturing Excellence Through CBE"';
    const mottoSize = fitSize(motto, bold, 8, 6, CW);
    page.drawText(motto, {
      x: pageW / 2 - bold.widthOfTextAtSize(motto, mottoSize) / 2,
      y: logoTop - LOGO_SIZE - 23,
      size: mottoSize, font: bold, color: darkRoyal
    });

    // Ministry line
    const ministryLine = "Ministry of Education | CBC / CBE Accredited Institution | Kenya";
    const ministrySize = fitSize(ministryLine, font, 7, 5.5, CW);
    page.drawText(ministryLine, {
      x: pageW / 2 - font.widthOfTextAtSize(ministryLine, ministrySize) / 2,
      y: logoTop - LOGO_SIZE - 33,
      size: ministrySize, font, color: slate
    });

    // Contact & P.O. Box
    const contactLine = "P.O. Box 40100, Kisumu, Kenya  |  Tel: +254 718 216 374  |  maryroyalschool81@gmail.com";
    const contactSize = fitSize(contactLine, font, 7, 5.5, CW);
    page.drawText(contactLine, {
      x: pageW / 2 - font.widthOfTextAtSize(contactLine, contactSize) / 2,
      y: logoTop - LOGO_SIZE - 44,
      size: contactSize, font, color: slate
    });

    // Campus line
    const campusLine = "Campus: Obunga (Near Breweries), Central Kisumu Sub-County, Kisumu County";
    const campusSize = fitSize(campusLine, font, 6.5, 5.5, CW);
    page.drawText(campusLine, {
      x: pageW / 2 - font.widthOfTextAtSize(campusLine, campusSize) / 2,
      y: logoTop - LOGO_SIZE - 54,
      size: campusSize, font, color: slate
    });

    // Double rule
    const RULE_Y = logoTop - LOGO_SIZE - 61;
    page.drawLine({ start: { x: MX, y: RULE_Y + 1.5 }, end: { x: pageW - MX, y: RULE_Y + 1.5 }, thickness: 1.5, color: royal });
    page.drawLine({ start: { x: MX, y: RULE_Y - 1   }, end: { x: pageW - MX, y: RULE_Y - 1   }, thickness: 0.4, color: gold  });

    // Title ribbon
    const RIBBON_TOP = RULE_Y - 4;
    page.drawRectangle({ x: MX, y: RIBBON_TOP - 20, width: CW, height: 20, color: deepNavy });
    page.drawRectangle({ x: MX, y: RIBBON_TOP - 22, width: CW, height: 2, color: gold });

    const ribbonTitle     = "LEARNER ADMISSION & CBE ENROLMENT DOSSIER";
    const ribbonTitleSize = fitSize(ribbonTitle, bold, 9, 7, CW - 20);
    page.drawText(ribbonTitle, {
      x: pageW / 2 - bold.widthOfTextAtSize(ribbonTitle, ribbonTitleSize) / 2,
      y: RIBBON_TOP - 13.5,
      size: ribbonTitleSize, font: bold, color: white
    });
    const refTag = `Ref: ${reference}  |  ${generatedAt}`;
    page.drawText(refTag, {
      x: pageW - MX - 8 - font.widthOfTextAtSize(refTag, 6.4),
      y: RIBBON_TOP - 13.5,
      size: 6.4, font, color: lightGold
    });

    y = RIBBON_TOP - 28;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTINUATION HEADER
  // ═══════════════════════════════════════════════════════════════════════════
  const drawContinuationHeader = () => {
    drawPageBorder(page);

    const logoWidth = drawLogo(page, MX, pageH - 32, 24);
    const textX     = MX + (logoWidth ? logoWidth + 10 : 0);
    page.drawText("MARY ROYAL PRIMARY & JUNIOR SCHOOL", { x: textX, y: pageH - 38, size: 8.2, font: bold, color: deepNavy });
    page.drawText(`Official Admission Dossier  -  ${reference}  -  Continued`, { x: textX, y: pageH - 48, size: 6.8, font, color: slate });

    const label = `Page ${pageIndex}`;
    const lW    = bold.widthOfTextAtSize(label, 7.5);
    page.drawText(label, { x: pageW - MX - lW, y: pageH - 40, size: 7.5, font: bold, color: royal });
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

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════
  const FIELD_H = 14;
  const LABEL_W = 110;

  const drawRow = (lbl: string, val: string, rx: number, rowY: number, w: number) => {
    page.drawRectangle({ x: rx, y: rowY - FIELD_H, width: w, height: FIELD_H, color: wash, borderColor: cardBorder, borderWidth: 0.4 });
    page.drawText(lbl.toUpperCase(), { x: rx + 5, y: rowY - 10, size: 5.9, font: bold, color: slate });
    const valText = value(val) || "\u2014";
    const valSize = fitSize(valText, bold, 7.5, 5.5, w - LABEL_W - 10);
    page.drawText(valText, { x: rx + LABEL_W, y: rowY - 10, size: valSize, font: bold, color: deepNavy });
  };

  const drawSection = (num: string, title: string) => {
    ensure(32);
    y -= 6;
    const badgeW = 18;
    page.drawRectangle({ x: MX, y: y - 12, width: badgeW, height: 12, color: darkRoyal });
    page.drawText(num, {
      x: MX + (badgeW - bold.widthOfTextAtSize(num, 7)) / 2,
      y: y - 9, size: 7, font: bold, color: white
    });
    page.drawText(title.toUpperCase(), { x: MX + badgeW + 6, y: y - 9, size: 7.5, font: bold, color: deepNavy });
    const afterTitle = MX + badgeW + 6 + bold.widthOfTextAtSize(title.toUpperCase(), 7.5) + 8;
    if (afterTitle < pageW - MX) {
      page.drawLine({ start: { x: afterTitle, y: y - 6 }, end: { x: pageW - MX, y: y - 6 }, thickness: 0.5, color: cardBorder });
    }
    y -= 15;
  };

  const drawGrid2 = (items: Array<[string, string]>) => {
    for (let i = 0; i < items.length; i += 2) {
      const left  = items[i];
      const right = items[i + 1];
      ensure(FIELD_H + 2);
      drawRow(left[0], left[1], MX, y, COL_W);
      if (right) drawRow(right[0], right[1], MX + COL_W + COL_GAP, y, COL_W);
      y -= FIELD_H + 2;
    }
  };

  const drawWide = (lbl: string, val: string) => {
    ensure(FIELD_H + 2);
    drawRow(lbl, val, MX, y, CW);
    y -= FIELD_H + 2;
  };

  const checkbox = (cbX: number, bottom: number, checked: boolean) => {
    page.drawRectangle({ x: cbX, y: bottom, width: 9, height: 9, borderColor: slate, borderWidth: 0.7, color: white });
    if (!checked) return;
    page.drawRectangle({ x: cbX, y: bottom, width: 9, height: 9, color: royal });
    page.drawLine({ start: { x: cbX + 2.2, y: bottom + 4.8 }, end: { x: cbX + 4, y: bottom + 2.4 }, thickness: 1.2, color: white });
    page.drawLine({ start: { x: cbX + 4,   y: bottom + 2.4 }, end: { x: cbX + 7.2, y: bottom + 7 }, thickness: 1.2, color: white });
  };

  const drawSealGraphic = (centerX: number, centerY: number, radius: number) => {
    page.drawCircle({ x: centerX, y: centerY, size: radius, borderColor: darkRoyal, borderWidth: 1.1 });
    page.drawCircle({ x: centerX, y: centerY, size: radius - 2.2, borderColor: gold, borderWidth: 0.5 });
    page.drawCircle({ x: centerX, y: centerY, size: radius - 5.5, borderColor: darkRoyal, borderWidth: 0.5 });
    const badgeW = (radius - 5) * 1.6;
    const badgeH = 13;
    page.drawRectangle({ x: centerX - badgeW / 2, y: centerY - badgeH / 2, width: badgeW, height: badgeH, color: darkRoyal });
    page.drawText("APPROVED", { x: centerX - 18, y: centerY - 3, size: 6.8, font: bold, color: white });
    page.drawText("MARY ROYAL SCHOOL", { x: centerX - 24, y: centerY + 9, size: 4.8, font: bold, color: deepNavy });
    page.drawText("OFFICIAL ENROLMENT SEAL", { x: centerX - 29, y: centerY - 14, size: 4.4, font: bold, color: gold });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  drawPageOneHeader();

  // ── Identity Hero ───────────────────────────────────────────────────────────
  const HERO_H  = 54;
  const PHOTO_W = 42;
  const PHOTO_H = HERO_H;
  const PHOTO_X = pageW - MX - PHOTO_W;
  const HERO_W  = CW - PHOTO_W - 8;

  page.drawRectangle({ x: MX, y: y - HERO_H, width: HERO_W, height: HERO_H, color: white, borderColor: cardBorder, borderWidth: 0.8 });
  page.drawRectangle({ x: MX, y: y - HERO_H, width: 3.5, height: HERO_H, color: royal });

  const applicantName = value(learner?.fullName) || "Applicant Learner";
  const nameSize      = fitSize(applicantName, bold, 13, 9, HERO_W - 24);
  page.drawText(applicantName, { x: MX + 10, y: y - 16, size: nameSize, font: bold, color: deepNavy });

  const admBadgeText = `ADM NO: ${draft.admissionNo}`;
  const admBadgeW    = bold.widthOfTextAtSize(admBadgeText, 7) + 12;
  page.drawRectangle({ x: MX + 10, y: y - 32, width: admBadgeW, height: 12, color: darkRoyal });
  page.drawText(admBadgeText, { x: MX + 16, y: y - 29, size: 7, font: bold, color: white });

  const statusText    = `STATUS: ${shortStatus.toUpperCase()}`;
  const statusW       = bold.widthOfTextAtSize(statusText, 6.5) + 14;
  const statusBg      = isEnrolled ? greenWash : wash;
  const statusBordCol = isEnrolled ? greenBorder : cardBorder;
  const statusTxtCol  = isEnrolled ? success    : slate;
  page.drawRectangle({ x: MX + 10, y: y - 47, width: statusW, height: 12, color: statusBg, borderColor: statusBordCol, borderWidth: 0.5 });
  page.drawText(statusText, { x: MX + 17, y: y - 44, size: 6.5, font: bold, color: statusTxtCol });

  // Photo box
  page.drawRectangle({ x: PHOTO_X, y: y - PHOTO_H, width: PHOTO_W, height: PHOTO_H, color: wash, borderColor: cardBorder, borderWidth: 0.8 });
  if (photo) {
    const pad    = 2;
    const availW = PHOTO_W - pad * 2;
    const availH = PHOTO_H - 12 - pad * 2;
    const scale  = Math.min(availW / photo.width, availH / photo.height);
    const imgW   = photo.width  * scale;
    const imgH   = photo.height * scale;
    page.drawImage(photo, {
      x: PHOTO_X + (PHOTO_W - imgW) / 2,
      y: y - PHOTO_H + 12 + (availH - imgH) / 2,
      width: imgW, height: imgH
    });
    const photoTag = "OFFICIAL PHOTO";
    page.drawText(photoTag, {
      x: PHOTO_X + (PHOTO_W - bold.widthOfTextAtSize(photoTag, 5)) / 2,
      y: y - PHOTO_H + 3.5,
      size: 5, font: bold, color: slate
    });
  } else {
    page.drawCircle({ x: PHOTO_X + PHOTO_W / 2, y: y - 20, size: 9, color: rgb(0.85, 0.88, 0.93) });
    page.drawRectangle({ x: PHOTO_X + PHOTO_W / 2 - 12, y: y - 38, width: 24, height: 9, color: rgb(0.85, 0.88, 0.93) });
    const photoTag = "PASSPORT PHOTO";
    page.drawText(photoTag, {
      x: PHOTO_X + (PHOTO_W - bold.widthOfTextAtSize(photoTag, 5)) / 2,
      y: y - PHOTO_H + 12,
      size: 5, font: bold, color: slate
    });
    const subTag = "Mary Royal Registry";
    page.drawText(subTag, {
      x: PHOTO_X + (PHOTO_W - font.widthOfTextAtSize(subTag, 4.5)) / 2,
      y: y - PHOTO_H + 4,
      size: 4.5, font, color: slate
    });
  }

  y -= HERO_H + 6;

  // ── Section 01: Learner Identification ─────────────────────────────────────
  drawSection("01", "Learner Identification & CBE Placement");
  drawGrid2([
    ["Grade Applied",           value(learner?.grade)],
    ["Stream Allocation",       value(learner?.stream) || "Default Stream"],
    ["Admission Date",          displayDate(learner?.admissionDate)],
    ["Nationality",             value(learner?.nationality) || "Kenyan"],
    ["Religion",                value(learner?.religion) || "Not provided"],
    ["Languages Spoken",        (learner?.languagesSpoken ?? []).join(", ") || "English, Kiswahili"],
    ["Previous School",         value(learner?.previousSchool) || "Not provided"],
    ["Previous Class Completed", value(learner?.previousClass) || "Not provided"]
  ]);
  if (learner?.reasonForLeaving) {
    drawWide("Reason for Leaving Previous School", learner.reasonForLeaving);
  }

  // ── Section 02: Residence ───────────────────────────────────────────────────
  drawSection("02", "Residential Address & Commute Particulars");
  const residence = data.residence;
  drawGrid2([
    ["County",             value(residence?.county)],
    ["Sub-County",         value(residence?.subCounty)],
    ["Ward",               value(residence?.ward)],
    ["Village / Estate",   value(residence?.village)],
    ["Distance to School", residence?.distanceToSchoolKm !== null && residence?.distanceToSchoolKm !== undefined
      ? `${residence.distanceToSchoolKm} km` : ""],
    ["Means of Commute",   value(residence?.transportMeans)]
  ]);
  if (residence?.physicalAddress || residence?.landmark) {
    const fullAddress = [
      value(residence?.physicalAddress),
      residence?.landmark ? `Nearest Landmark: ${residence.landmark}` : ""
    ].filter(Boolean).join("  -  ");
    drawWide("Physical Residential Address", fullAddress);
  }

  // ── Section 03: Guardians ───────────────────────────────────────────────────
  drawSection("03", "Parents & Authorized Legal Guardians");
  const guardians = data.guardians ?? [];
  if (!guardians.length) {
    drawWide("Guardian Details", "Not provided");
  } else {
    guardians.forEach((guardian, index) => {
      const isPrimary = guardian.primaryContact;
      const subtitle  = `Guardian ${index + 1}: ${value(guardian.fullName)} (${value(guardian.relationship)})${isPrimary ? " - PRIMARY CONTACT" : ""}`;
      ensure(16);
      page.drawText(subtitle.toUpperCase(), { x: MX, y: y - 2, size: 7.2, font: bold, color: isPrimary ? darkRoyal : slate });
      y -= 10;
      drawGrid2([
        ["Full Legal Name",        value(guardian.fullName)],
        ["Relationship",           value(guardian.relationship)],
        ["Primary Telephone",      value(guardian.phone)],
        ["Alternate Tel.",         value(guardian.alternatePhone)],
        ["Email Address",          value(guardian.email)],
        ["National ID / Passport", value(guardian.idNumber)],
        ["Occupation",             value(guardian.occupation)],
        ["Employer / Business",    value(guardian.employer)]
      ]);
      if (guardian.homeAddress) drawWide("Home Address", value(guardian.homeAddress));
    });
  }

  // ── Section 04: Emergency Contacts ─────────────────────────────────────────
  drawSection("04", "Emergency Contacts & Authorized Pickup");
  const emergencyContacts = data.emergencyContacts ?? [];
  const emergencyPairs: Array<[string, string]> = [];
  if (emergencyContacts.length) {
    emergencyContacts.forEach((contact, idx) => {
      emergencyPairs.push([
        `Emergency Contact ${idx + 1}`,
        `${value(contact.fullName)} (${value(contact.relationship)}) - Tel: ${value(contact.phone)}`
      ]);
    });
  } else {
    emergencyPairs.push(["Emergency Contact", "Not provided"]);
  }
  const pickupPersons = data.pickupPersons ?? [];
  if (pickupPersons.length) {
    pickupPersons.forEach((person, idx) => {
      emergencyPairs.push([
        `Authorized Collector ${idx + 1}`,
        `${value(person.fullName)} (${value(person.relationship)}) - Tel: ${value(person.phone)}`
      ]);
    });
  }
  drawGrid2(emergencyPairs);

  // ── Section 05: Health (Confidential) ──────────────────────────────────────
  drawSection("05", "Health & Medical Information (Confidential)");
  ensure(16);
  page.drawText("CONFIDENTIAL - RESTRICTED TO AUTHORIZED SCHOOL LEADERS AND CLASS TEACHER", {
    x: MX, y: y - 2, size: 6.5, font: bold, color: darkRoyal
  });
  y -= 10;
  const health = data.health;
  drawGrid2([
    ["Blood Group",              value(health?.bloodGroup)],
    ["Immunisation Status",      value(health?.immunizationStatus)],
    ["Preferred Hospital / Doctor", value(health?.doctorOrHospital)],
    ["Health Insurance",         value(health?.healthInsurance)]
  ]);
  if (value(health?.knownConditions)) drawWide("Known Medical Conditions", value(health?.knownConditions));
  if (value(health?.allergies))       drawWide("Allergies & Sensitivities",  value(health?.allergies));
  if (value(health?.currentMedication)) drawWide("Current Medication",       value(health?.currentMedication));
  if (value(health?.specialNeeds))    drawWide("Special Educational Needs",  value(health?.specialNeeds));

  // ── Section 06: Fee Handoff ─────────────────────────────────────────────────
  drawSection("06", "Fee Handoff & Optional Services");
  drawGrid2([
    ["Admission Term",          value(data.fee?.term)],
    ["Responsible Fee Payer",   value(data.fee?.feePayerGuardian)],
    ["Optional Services",       (data.fee?.requestedOptionalItems ?? []).join(", ") || "None requested"],
    ["Data Protection Consent", data.consent ? "Granted - Kenya Data Protection Act 2019" : "Not recorded"]
  ]);
  if (value(data.fee?.handoffNote)) drawWide("Accountant Handoff Note", value(data.fee?.handoffNote));

  // ── Section 07: Document Checklist ─────────────────────────────────────────
  drawSection("07", "Verified Admission Document Checklist");
  const documentEntries = Object.entries(admissionDocumentCategoryLabels);
  const checklistColW   = CW / 2;
  for (let index = 0; index < documentEntries.length; index += 2) {
    ensure(18);
    for (let column = 0; column < 2 && index + column < documentEntries.length; column += 1) {
      const [category, docLabel] = documentEntries[index + column];
      const uploaded = draft.documents.some((document) => document.category === category);
      const cx       = MX + column * checklistColW;
      checkbox(cx + 1, y - 9, uploaded);
      const mandatory  = category === "PASSPORT_PHOTO" || category === "BIRTH_CERTIFICATE" ? " (mandatory)" : "";
      const labelText  = `${docLabel}${mandatory}`;
      page.drawText(labelText, {
        x: cx + 15, y: y - 8.5,
        size: fitSize(labelText, font, 7.5, 5.8, checklistColW - 68),
        font, color: uploaded ? deepNavy : slate
      });
      if (uploaded) {
        page.drawText("Received", { x: cx + checklistColW - 46, y: y - 8.5, size: 6.2, font: bold, color: success });
      }
    }
    y -= 16;
  }
  y -= 4;

  // ── Section 08: Audit History ───────────────────────────────────────────────
  drawSection("08", "Admission Packet Audit & History");
  drawGrid2([
    ["Record Created",         displayDateTime(draft.createdAt)],
    ["Submitted For Approval", displayDateTime(draft.submittedAt)],
    ["Enrolment Confirmed",    displayDateTime(draft.enrolledAt ?? draft.learner?.admissionApprovedAt ?? null)],
    ["Last Updated",           displayDateTime(draft.updatedAt)],
    ["Issued By Role",         ROLE_LABELS[user.role] ?? user.role],
    ["Document Security Ref",  reference]
  ]);

  // ── Section 09: Declaration & Endorsement ──────────────────────────────────
  const declaration = "The parent or legal guardian confirms that the information furnished in this admission dossier is true, complete, and accurate. The school confirms receipt of the admission documents listed above. Final enrolment is subject to Head Teacher approval and official registration under the Kenya Basic Education Act and CBC/CBE guidelines.";
  const declarationLines = wrap(declaration, font, 7.3, CW);
  const sigCardH   = 62;
  const panelH     = 56;

  ensure(declarationLines.length * 9.5 + sigCardH + panelH + 64);
  drawSection("09", "Declarations & Institutional Endorsement");

  for (const item of declarationLines) {
    page.drawText(item, { x: MX, y, size: 7.3, font, color: deepNavy });
    y -= 9.5;
  }
  y -= 10;

  // 3 Signature blocks
  const sigGap = 10;
  const sigW   = (CW - sigGap * 2) / 3;
  ensure(sigCardH + 8);

  const b1X = MX;
  page.drawRectangle({ x: b1X, y: y - sigCardH, width: sigW, height: sigCardH, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawText("PARENT / LEGAL GUARDIAN", { x: b1X + 8, y: y - 12, size: 6.4, font: bold, color: deepNavy });
  page.drawLine({ start: { x: b1X + 8, y: y - sigCardH + 22 }, end: { x: b1X + sigW - 8, y: y - sigCardH + 22 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Signature & Date", { x: b1X + 8, y: y - sigCardH + 11, size: 5.8, font, color: slate });

  const b2X = MX + sigW + sigGap;
  page.drawRectangle({ x: b2X, y: y - sigCardH, width: sigW, height: sigCardH, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawText("ADMISSIONS SECRETARY", { x: b2X + 8, y: y - 12, size: 6.4, font: bold, color: deepNavy });
  page.drawLine({ start: { x: b2X + 8, y: y - sigCardH + 22 }, end: { x: b2X + sigW - 8, y: y - sigCardH + 22 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Verified & Duly Cleared", { x: b2X + 8, y: y - sigCardH + 11, size: 5.8, font, color: slate });

  const b3X = MX + (sigW + sigGap) * 2;
  page.drawRectangle({ x: b3X, y: y - sigCardH, width: sigW, height: sigCardH, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawText("HEAD TEACHER / DIRECTOR", { x: b3X + 8, y: y - 12, size: 6.4, font: bold, color: deepNavy });
  drawSealGraphic(b3X + sigW - 28, y - sigCardH + 28, 22);
  page.drawLine({ start: { x: b3X + 8, y: y - sigCardH + 22 }, end: { x: b3X + sigW - 56, y: y - sigCardH + 22 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Official Approval & Seal", { x: b3X + 8, y: y - sigCardH + 11, size: 5.8, font, color: slate });

  y -= sigCardH + 10;

  // ── QR Verification panel ───────────────────────────────────────────────────
  ensure(panelH + 6);
  page.drawRectangle({ x: MX, y: y - panelH, width: CW, height: panelH, color: wash, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawRectangle({ x: MX, y: y - panelH, width: 3, height: panelH, color: royal });

  let qrWidth = 0;
  try {
    const qrData = `MARY_ROYAL_ADMISSION:${draft.id}:${draft.admissionNo}:${value(learner?.fullName) || "Learner"}:${draft.status}`;
    const matrix = generateQrMatrix(qrData);
    const size   = 40;
    const pixel  = size / matrix.length;
    const qrX    = MX + 10;
    const qrY    = y - panelH + 8;
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        if (matrix[row][col]) {
          page.drawRectangle({ x: qrX + col * pixel, y: qrY + (matrix.length - 1 - row) * pixel, width: pixel, height: pixel, color: deepNavy });
        }
      }
    }
    qrWidth = size + 12;
  } catch {
    qrWidth = 0;
  }

  const qrTextX     = MX + 10 + qrWidth;
  const qrTextWidth = CW - (qrTextX - MX) - 10;
  page.drawText("INSTITUTIONAL DOCUMENT VERIFICATION", { x: qrTextX, y: y - 14, size: 6.3, font: bold, color: royal });
  const verifyNotice = "Scan the QR code or present reference MR-ADM to Mary Royal School registry to verify official admission dossier.";
  for (const [idx, item] of wrap(verifyNotice, font, 7, qrTextWidth).slice(0, 2).entries()) {
    page.drawText(item, { x: qrTextX, y: y - 25 - idx * 8.8, size: 7, font, color: deepNavy });
  }
  const verifyLine = `Ref: ${reference}  -  Status: ${shortStatus}  -  Issued: ${generatedAt}  -  Auth: ${ROLE_LABELS[user.role] ?? user.role}`;
  page.drawText(verifyLine, {
    x: qrTextX, y: y - 45,
    size: fitSize(verifyLine, font, 6.4, 5.2, qrTextWidth),
    font, color: slate
  });
  y -= panelH;

  // ═══════════════════════════════════════════════════════════════════════════
  // RUNNING FOOTER on every page
  // ═══════════════════════════════════════════════════════════════════════════
  const totalPages = pdf.getPageCount();
  for (let idx = 0; idx < totalPages; idx += 1) {
    const fp = pdf.getPage(idx);

    // Double rule
    fp.drawLine({ start: { x: MX, y: 46 }, end: { x: pageW - MX, y: 46 }, thickness: 0.6, color: royal });
    fp.drawLine({ start: { x: MX, y: 44 }, end: { x: pageW - MX, y: 44 }, thickness: 0.3, color: gold  });

    // Left: school name + detail
    fp.drawText("Mary Royal Primary & Junior School", { x: MX, y: 37, size: 7, font: bold, color: deepNavy });
    fp.drawText("Obunga (Near Breweries), Kisumu  |  CBC/CBE Accredited  |  Official Admission Record.", {
      x: MX, y: 28, size: 5.8, font, color: slate
    });

    // Right: page info
    const footRight = `Page ${idx + 1} of ${totalPages}  |  ${reference}  |  ${generatedStamp} EAT`;
    fp.drawText(footRight, {
      x: pageW - MX - font.widthOfTextAtSize(footRight, 5.8),
      y: 28, size: 5.8, font, color: slate
    });

    // Authority line centered
    const authLine = "Official under the Kenya Basic Education Act  |  Issued by Mary Royal School Registry";
    fp.drawText(authLine, {
      x: pageW / 2 - font.widthOfTextAtSize(authLine, 5.5) / 2,
      y: 20, size: 5.5, font, color: slate
    });
  }

  // ── Audit event ─────────────────────────────────────────────────────────────
  await db.auditEvent.create({
    data: { actorId: user.id, action: "ADMISSION_FORM_EXPORTED", entity: "AdmissionDraft", entityId: id }
  });

  const bytes = await pdf.save();
  const body  = new ArrayBuffer(bytes.byteLength);
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

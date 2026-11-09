import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage } from "pdf-lib";
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

  // ── Colour palette ──────────────────────────────────────────────────────────
  const deepNavy    = rgb(0.027, 0.071, 0.141);
  const royal       = rgb(0.114, 0.306, 0.847);
  const darkRoyal   = rgb(0.086, 0.22,  0.58);
  const gold        = rgb(0.78,  0.6,   0.17);
  const lightGold   = rgb(0.96,  0.92,  0.82);
  const slate       = rgb(0.357, 0.42,  0.51);
  const wash        = rgb(0.965, 0.976, 0.992);
  const cardBorder  = rgb(0.855, 0.886, 0.933);
  const white       = rgb(1, 1, 1);
  const greenText   = rgb(0.086, 0.45, 0.22);
  const greenWash   = rgb(0.92,  0.97,  0.94);
  const greenBorder = rgb(0.74,  0.89,  0.78);

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Admission Slip ${learner.admissionNo} - ${value(learner.name)} - Mary Royal School`);
  pdf.setAuthor("Mary Royal Primary & Junior School, Obunga, Kisumu");
  pdf.setSubject("Official learner admission slip and enrolment record");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595.28;
  const pageH = 841.89;
  const MX    = 32;
  const CW    = pageW - MX * 2;
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

  // ── Load applicant passport photo ───────────────────────────────────────────
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

  const reference      = `MR-SLIP/${learner.admissionNo}`;
  const status         = STATUS_LABELS[learner.admissionStatus] ?? (value(learner.admissionStatus) || "Recorded");
  const isEnrolled     = learner.admissionStatus === "APPROVED";
  const generatedAt    = displayDate(new Date().toISOString().slice(0, 10));
  const generatedStamp = displayDateTime(new Date());

  // ── Single page ─────────────────────────────────────────────────────────────
  const page = pdf.addPage([pageW, pageH]);
  let y = pageH;

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE BORDER
  // ═══════════════════════════════════════════════════════════════════════════
  page.drawRectangle({ x: 14, y: 14, width: pageW - 28, height: pageH - 28, borderColor: royal, borderWidth: 1 });
  page.drawRectangle({ x: 17, y: 17, width: pageW - 34, height: pageH - 34, borderColor: gold,  borderWidth: 0.4 });
  const cornerSize = 5;
  for (const c of [
    { x: 13,                    y: 13 },
    { x: pageW - 14 - cornerSize, y: 13 },
    { x: 13,                    y: pageH - 14 - cornerSize },
    { x: pageW - 14 - cornerSize, y: pageH - 14 - cornerSize }
  ]) {
    page.drawRectangle({ x: c.x, y: c.y, width: cornerSize, height: cornerSize, color: royal });
    page.drawRectangle({ x: c.x + 1, y: c.y + 1, width: cornerSize - 2, height: cornerSize - 2, color: gold });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER — centered masthead
  // ═══════════════════════════════════════════════════════════════════════════
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

  // Ministry line centered
  const ministryLine = "Ministry of Education | CBC / CBE Accredited Institution | Kenya";
  const ministrySize = fitSize(ministryLine, font, 7, 5.5, CW);
  page.drawText(ministryLine, {
    x: pageW / 2 - font.widthOfTextAtSize(ministryLine, ministrySize) / 2,
    y: logoTop - LOGO_SIZE - 33,
    size: ministrySize, font, color: slate
  });

  // Contact & P.O. Box centered
  const contactLine = "P.O. Box 40100, Kisumu, Kenya  |  Tel: +254 718 216 374  |  maryroyalschool81@gmail.com";
  const contactSize = fitSize(contactLine, font, 7, 5.5, CW);
  page.drawText(contactLine, {
    x: pageW / 2 - font.widthOfTextAtSize(contactLine, contactSize) / 2,
    y: logoTop - LOGO_SIZE - 44,
    size: contactSize, font, color: slate
  });

  // Campus line centered
  const campusLine = "Campus: Obunga (Near Breweries), Central Kisumu Sub-County, Kisumu County";
  const campusSize = fitSize(campusLine, font, 6.5, 5.5, CW);
  page.drawText(campusLine, {
    x: pageW / 2 - font.widthOfTextAtSize(campusLine, campusSize) / 2,
    y: logoTop - LOGO_SIZE - 54,
    size: campusSize, font, color: slate
  });

  // Double rule below masthead
  const RULE_Y = logoTop - LOGO_SIZE - 61;
  page.drawLine({ start: { x: MX, y: RULE_Y + 1.5 }, end: { x: pageW - MX, y: RULE_Y + 1.5 }, thickness: 1.5, color: royal });
  page.drawLine({ start: { x: MX, y: RULE_Y - 1   }, end: { x: pageW - MX, y: RULE_Y - 1   }, thickness: 0.4, color: gold  });

  // Title ribbon
  const RIBBON_TOP = RULE_Y - 4;
  page.drawRectangle({ x: MX, y: RIBBON_TOP - 20, width: CW, height: 20, color: deepNavy });
  page.drawRectangle({ x: MX, y: RIBBON_TOP - 22, width: CW, height: 2, color: gold });

  const ribbonTitle     = "OFFICIAL LEARNER ADMISSION SLIP & ENROLMENT CERTIFICATE";
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
      drawRow(left[0], left[1], MX, y, COL_W);
      if (right) drawRow(right[0], right[1], MX + COL_W + COL_GAP, y, COL_W);
      y -= FIELD_H + 2;
    }
  };

  const drawWide = (lbl: string, val: string) => {
    drawRow(lbl, val, MX, y, CW);
    y -= FIELD_H + 2;
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // IDENTITY HERO
  // ═══════════════════════════════════════════════════════════════════════════
  const HERO_H  = 54;
  const PHOTO_W = 42;
  const PHOTO_H = HERO_H;
  const PHOTO_X = pageW - MX - PHOTO_W;
  const HERO_W  = CW - PHOTO_W - 8;

  page.drawRectangle({ x: MX, y: y - HERO_H, width: HERO_W, height: HERO_H, color: white, borderColor: cardBorder, borderWidth: 0.8 });
  page.drawRectangle({ x: MX, y: y - HERO_H, width: 3.5, height: HERO_H, color: royal });

  const learnerName = value(learner.name);
  const nameSize    = fitSize(learnerName, bold, 13, 9, HERO_W - 24);
  page.drawText(learnerName, { x: MX + 10, y: y - 16, size: nameSize, font: bold, color: deepNavy });

  const admBadgeText = `ADM NO: ${pdfText(learner.admissionNo)}`;
  const admBadgeW    = bold.widthOfTextAtSize(admBadgeText, 7) + 12;
  page.drawRectangle({ x: MX + 10, y: y - 32, width: admBadgeW, height: 12, color: darkRoyal });
  page.drawText(admBadgeText, { x: MX + 16, y: y - 29, size: 7, font: bold, color: white });

  const statusText    = `STATUS: ${status.toUpperCase()}`;
  const statusW       = bold.widthOfTextAtSize(statusText, 6.5) + 14;
  const statusBg      = isEnrolled ? greenWash : wash;
  const statusBordCol = isEnrolled ? greenBorder : cardBorder;
  const statusTxtCol  = isEnrolled ? greenText   : slate;
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 01 — Enrolment Details
  // ═══════════════════════════════════════════════════════════════════════════
  const admissionDate = profile?.admissionDate ?? learner.admissionApprovedAt ?? null;
  drawSection("01", "Enrolment Details & CBE Placement");
  drawGrid2([
    ["Grade / Class",           value(learner.grade)],
    ["Stream Allocation",       profile?.stream ?? draftLearner.stream ?? "Default Stream"],
    ["Curriculum Pathway",      "Kenya CBC / CBE"],
    ["Nationality",             profile?.nationality ?? draftLearner.nationality ?? "Kenyan"],
    ["Enrolment Date",          displayDate(admissionDate) || displayDate(draftLearner.admissionDate) || "\u2014"],
    ["Enrolment Confirmed",     displayDateTime(learner.admissionApprovedAt) || "Recorded"],
    ["UPI / NEMIS No.",         profile?.upiNumber ?? draftLearner.upiNumber ?? "Pending MOE Allocation"],
    ["Gender & Date of Birth",  `${value(learner.gender)} - ${displayDate(profile?.dateOfBirth) || displayDate(draftLearner.dateOfBirth) || "Not provided"}`]
  ]);
  if (profile?.previousSchool || draftLearner.previousSchool) {
    drawGrid2([
      ["Previous School",       profile?.previousSchool ?? draftLearner.previousSchool ?? ""],
      ["Last Class Completed",  profile?.previousClass  ?? draftLearner.previousClass  ?? ""]
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 02 — Residential Address
  // ═══════════════════════════════════════════════════════════════════════════
  drawSection("02", "Residential Address & Commute");
  drawGrid2([
    ["County",             profile?.county    ?? draftResidence.county    ?? ""],
    ["Sub-County",         profile?.subCounty ?? draftResidence.subCounty ?? ""],
    ["Ward",               profile?.ward      ?? draftResidence.ward      ?? ""],
    ["Village / Estate",   profile?.village   ?? draftResidence.village   ?? ""],
    ["Distance to School", profile?.distanceToSchoolKm !== null && profile?.distanceToSchoolKm !== undefined
      ? `${profile.distanceToSchoolKm} km`
      : draftResidence.distanceToSchoolKm !== null && draftResidence.distanceToSchoolKm !== undefined
        ? `${draftResidence.distanceToSchoolKm} km` : ""],
    ["Means of Commute",   profile?.transportMeans ?? draftResidence.transportMeans ?? ""]
  ]);
  const physAddr = profile?.physicalAddress ?? draftResidence.physicalAddress ?? "";
  const landmark = profile?.landmark ?? draftResidence.landmark ?? "";
  if (physAddr || landmark) {
    drawWide("Physical Address", [physAddr, landmark ? `Landmark: ${landmark}` : ""].filter(Boolean).join("  -  "));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 03 — Primary Guardian
  // ═══════════════════════════════════════════════════════════════════════════
  drawSection("03", "Parent & Authorized Legal Guardian");
  const profileGuardians = profile?.guardians ?? [];
  const draftGuardians   = data.guardians ?? [];
  const portalGuardians  = learner.guardians;

  if (profileGuardians.length) {
    const g = profileGuardians[0];
    drawGrid2([
      ["Full Legal Name",        g.fullName],
      ["Relationship",           g.relationship],
      ["Primary Telephone",      g.phone],
      ["Alternate Tel.",         g.alternatePhone ?? ""],
      ["Email Address",          g.email ?? ""],
      ["National ID / Passport", g.idNumber ?? ""]
    ]);
    if (g.homeAddress) drawWide("Home Address", g.homeAddress);
    if (profileGuardians.length > 1) {
      const g2 = profileGuardians[1];
      y -= 2;
      page.drawText(`2nd Guardian: ${g2.fullName} (${g2.relationship})  Tel: ${g2.phone}`, { x: MX, y, size: 6.5, font, color: slate });
      y -= 10;
    }
  } else if (draftGuardians.length) {
    const g = draftGuardians[0];
    drawGrid2([
      ["Full Legal Name",        value(g.fullName)],
      ["Relationship",           value(g.relationship)],
      ["Primary Telephone",      value(g.phone)],
      ["Alternate Tel.",         value(g.alternatePhone)],
      ["Email Address",          value(g.email)],
      ["National ID / Passport", value(g.idNumber)]
    ]);
    if (g.homeAddress) drawWide("Home Address", value(g.homeAddress));
    if (draftGuardians.length > 1) {
      const g2 = draftGuardians[1];
      y -= 2;
      page.drawText(`2nd Guardian: ${value(g2.fullName)} (${value(g2.relationship)})  Tel: ${value(g2.phone)}`, { x: MX, y, size: 6.5, font, color: slate });
      y -= 10;
    }
  } else if (portalGuardians.length) {
    const g = portalGuardians[0];
    drawGrid2([
      ["Full Legal Name", g.user.name],
      ["Relationship",    g.relation],
      ["Telephone",       g.user.phone ?? ""],
      ["Email Address",   g.user.email ?? ""]
    ]);
  } else {
    drawWide("Guardian Details", "Not provided");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 04 — Emergency Contacts
  // ═══════════════════════════════════════════════════════════════════════════
  drawSection("04", "Emergency Contacts & Authorized Pickup");
  const profileEmergency = profile?.emergencyContacts ?? [];
  const draftEmergency   = data.emergencyContacts ?? [];
  const profilePickup    = profile?.pickupPersons ?? [];
  const draftPickup      = data.pickupPersons ?? [];

  const ecSource = profileEmergency.length ? profileEmergency : draftEmergency;
  const puSource = profilePickup.length    ? profilePickup    : draftPickup;

  if (ecSource.length) {
    const ec = ecSource[0];
    const ecFullName  = "fullName"     in ec ? String(ec.fullName)     : "";
    const ecRelation  = "relationship" in ec ? String(ec.relationship) : "";
    const ecPhone     = "phone"        in ec ? String(ec.phone)        : "";
    const puText = puSource.length
      ? (() => {
          const pu = puSource[0];
          const puFullName = "fullName" in pu ? String(pu.fullName) : "";
          const puPhone    = "phone"    in pu ? String(pu.phone)    : "";
          return `${puFullName} - Tel: ${puPhone}`;
        })()
      : "Same as guardian";
    drawGrid2([
      ["Emergency Contact",    `${ecFullName} (${ecRelation}) - Tel: ${ecPhone}`],
      ["Authorized Collector", puText]
    ]);
  } else {
    drawGrid2([
      ["Emergency Contact",    "Not provided"],
      ["Authorized Collector", "Not provided"]
    ]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 05 — Declaration & Signatures
  // ═══════════════════════════════════════════════════════════════════════════
  drawSection("05", "Declaration & Institutional Endorsement");

  const declaration = "The parent or legal guardian confirms that all information furnished is true, complete, and accurate. The learner is admitted subject to Mary Royal School regulations, the Basic Education Act, and Kenya CBC/CBE. Personal data is protected under the Kenya Data Protection Act 2019.";
  const declLines   = wrap(declaration, font, 7, CW);
  for (const line of declLines.slice(0, 2)) {
    page.drawText(line, { x: MX, y, size: 7, font, color: deepNavy });
    y -= 9;
  }

  const consentAt   = profile?.consentAt ?? null;
  const consentLine = data.consent || consentAt
    ? `Data protection consent: Granted & Logged${consentAt ? ` on ${displayDate(consentAt.toISOString().slice(0, 10))}` : ""}`
    : "Data protection consent: Not recorded";
  y -= 2;
  page.drawText(consentLine, { x: MX, y, size: 6.5, font: bold, color: darkRoyal });
  y -= 10;

  // 3 Signature blocks
  const SIG_H  = 46;
  const sigGap = 8;
  const sigW   = (CW - sigGap * 2) / 3;

  const drawSigBox = (bx: number, title: string, subtitle: string) => {
    page.drawRectangle({ x: bx, y: y - SIG_H, width: sigW, height: SIG_H, color: white, borderColor: cardBorder, borderWidth: 0.7 });
    page.drawRectangle({ x: bx, y: y - SIG_H, width: sigW, height: 2, color: royal });
    page.drawText(title.toUpperCase(), { x: bx + 6, y: y - 10, size: 5.9, font: bold, color: deepNavy });
    page.drawLine({ start: { x: bx + 6, y: y - SIG_H + 18 }, end: { x: bx + sigW - 6, y: y - SIG_H + 18 }, thickness: 0.5, color: darkRoyal });
    page.drawText(subtitle, { x: bx + 6, y: y - SIG_H + 8, size: 5.5, font, color: slate });
  };

  drawSigBox(MX, "Parent / Legal Guardian", "Signature & Date");
  drawSigBox(MX + sigW + sigGap, "Admissions Secretary", "Verified & Duly Cleared");

  const b3X = MX + (sigW + sigGap) * 2;
  page.drawRectangle({ x: b3X, y: y - SIG_H, width: sigW, height: SIG_H, color: white, borderColor: cardBorder, borderWidth: 0.7 });
  page.drawRectangle({ x: b3X, y: y - SIG_H, width: sigW, height: 2, color: royal });
  page.drawText("HEAD TEACHER / DIRECTOR", { x: b3X + 6, y: y - 10, size: 5.9, font: bold, color: deepNavy });
  // Compact official seal
  const sealX = b3X + sigW - 22;
  const sealY = y - SIG_H + 24;
  page.drawCircle({ x: sealX, y: sealY, size: 18, borderColor: darkRoyal, borderWidth: 0.9 });
  page.drawCircle({ x: sealX, y: sealY, size: 15.5, borderColor: gold, borderWidth: 0.4 });
  page.drawCircle({ x: sealX, y: sealY, size: 12, borderColor: darkRoyal, borderWidth: 0.4 });
  page.drawRectangle({ x: sealX - 11, y: sealY - 4.5, width: 22, height: 9, color: darkRoyal });
  page.drawText("APPROVED", { x: sealX - 10.5, y: sealY - 2.5, size: 5.5, font: bold, color: white });
  page.drawText("MARY ROYAL", { x: sealX - 10, y: sealY + 6, size: 4.2, font: bold, color: deepNavy });
  page.drawText("OFFICIAL SEAL", { x: sealX - 10.5, y: sealY - 10, size: 3.8, font: bold, color: gold });
  page.drawLine({ start: { x: b3X + 6, y: y - SIG_H + 18 }, end: { x: b3X + sigW - 44, y: y - SIG_H + 18 }, thickness: 0.5, color: darkRoyal });
  page.drawText("Official Approval & Seal", { x: b3X + 6, y: y - SIG_H + 8, size: 5.5, font, color: slate });

  y -= SIG_H + 6;

  // ═══════════════════════════════════════════════════════════════════════════
  // QR Verification panel
  // ═══════════════════════════════════════════════════════════════════════════
  const QR_PANEL_H = 42;
  page.drawRectangle({ x: MX, y: y - QR_PANEL_H, width: CW, height: QR_PANEL_H, color: wash, borderColor: cardBorder, borderWidth: 0.6 });
  page.drawRectangle({ x: MX, y: y - QR_PANEL_H, width: 3, height: QR_PANEL_H, color: royal });

  let qrWidth = 0;
  try {
    const qrData = `MARY_ROYAL_ADMISSION_SLIP:${learner.id}:${learner.admissionNo}:${value(learner.name)}:${learner.grade}:${learner.admissionStatus}`;
    const matrix = generateQrMatrix(qrData);
    const size   = 32;
    const pixel  = size / matrix.length;
    const qrX    = MX + 8;
    const qrY    = y - QR_PANEL_H + 5;
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        if (matrix[row][col]) {
          page.drawRectangle({ x: qrX + col * pixel, y: qrY + (matrix.length - 1 - row) * pixel, width: pixel, height: pixel, color: deepNavy });
        }
      }
    }
    qrWidth = size + 10;
  } catch {
    qrWidth = 0;
  }

  const qrTextX     = MX + 8 + qrWidth;
  const qrTextWidth = CW - qrWidth - 16;
  page.drawText("INSTITUTIONAL DOCUMENT VERIFICATION", { x: qrTextX, y: y - 11, size: 6, font: bold, color: royal });
  page.drawText("Scan QR or present reference to Mary Royal School registry to verify official enrolment.", { x: qrTextX, y: y - 21, size: 6.3, font, color: deepNavy });
  const verifyLine = `Ref: ${reference}  -  Status: ${status}  -  Issued: ${generatedAt}  -  By: ${ROLE_LABELS[user.role] ?? value(user.role)}`;
  page.drawText(verifyLine, {
    x: qrTextX, y: y - 32,
    size: fitSize(verifyLine, font, 6.3, 5, qrTextWidth),
    font, color: slate
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FOOTER
  // ═══════════════════════════════════════════════════════════════════════════
  const FOOTER_Y = 46;

  page.drawLine({ start: { x: MX, y: FOOTER_Y + 10 }, end: { x: pageW - MX, y: FOOTER_Y + 10 }, thickness: 0.6, color: royal });
  page.drawLine({ start: { x: MX, y: FOOTER_Y + 8  }, end: { x: pageW - MX, y: FOOTER_Y + 8  }, thickness: 0.3, color: gold  });

  page.drawText("Mary Royal Primary & Junior School", { x: MX, y: FOOTER_Y + 1, size: 7, font: bold, color: deepNavy });

  page.drawText("Obunga (Near Breweries), Kisumu  |  CBC/CBE Accredited  |  This slip is NOT a fee receipt.", {
    x: MX, y: FOOTER_Y - 8, size: 5.8, font, color: slate
  });

  const footRight = `Page 1 of 1  |  ${reference}  |  ${generatedStamp} EAT`;
  page.drawText(footRight, {
    x: pageW - MX - font.widthOfTextAtSize(footRight, 5.8),
    y: FOOTER_Y - 8,
    size: 5.8, font, color: slate
  });

  const authLine = "Official under the Kenya Basic Education Act  |  Issued by Mary Royal School Registry";
  page.drawText(authLine, {
    x: pageW / 2 - font.widthOfTextAtSize(authLine, 5.5) / 2,
    y: FOOTER_Y - 17,
    size: 5.5, font, color: slate
  });

  // ── Audit event ─────────────────────────────────────────────────────────────
  await db.auditEvent.create({
    data: { actorId: user.id, action: "ADMISSION_SLIP_EXPORTED", entity: "Learner", entityId: learner.id }
  });

  const bytes = await pdf.save();
  const body  = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const inline = new URL(request.url).searchParams.get("download") === "0";
  const safeAdmissionNo = value(learner.admissionNo).replace(/[^A-Za-z0-9._-]+/g, "-") || learner.id;
  const safeName        = value(learner.name).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "Learner";
  return new NextResponse(body, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${inline ? "inline" : "attachment"}; filename="Mary-Royal-Admission-Slip-${safeAdmissionNo}-${safeName}.pdf"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

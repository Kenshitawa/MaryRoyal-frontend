import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CBC_LEVEL_BANDS, cbcLevel } from "./grading";

export type ReportCardAssessment = {
  subject: string;
  score: number;
  comment: string | null;
};

export type ReportCardInput = {
  learner: {
    name: string;
    admissionNo: string;
    grade: string;
  };
  term: string;
  assessments: ReportCardAssessment[];
  generatedAt?: Date;
  logoBytes: Uint8Array;
};

function pdfText(input: string) {
  return input
    .replace(/[\u2018\u2019\u201A\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\u00A1-\u00FF]/g, "?");
}

function fitSize(text: string, font: PDFFont, preferred: number, minimum: number, width: number) {
  let size = preferred;
  while (size > minimum && font.widthOfTextAtSize(text, size) > width) size -= 0.2;
  return Math.max(size, minimum);
}

function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of pdfText(text).split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildReportCardPdf(input: ReportCardInput) {
  const navy = rgb(0.063, 0.137, 0.247);
  const blue = rgb(0.114, 0.306, 0.847);
  const slate = rgb(0.35, 0.4, 0.47);
  const wash = rgb(0.96, 0.97, 0.985);
  const rule = rgb(0.86, 0.88, 0.92);
  const white = rgb(1, 1, 1);
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 35;
  const contentW = pageW - margin * 2;
  const contentBottom = 54;

  const pdf = await PDFDocument.create();
  pdf.setTitle(`CBE Progress Report - ${input.learner.name} (${input.learner.admissionNo}) - ${input.term}`);
  pdf.setAuthor("Mary Royal Primary & Junior School");
  pdf.setSubject("Learner CBE progress report");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(input.logoBytes);
  const generatedAt = input.generatedAt ?? new Date();
  const timestamp = new Intl.DateTimeFormat("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Nairobi"
  }).format(generatedAt);

  let page!: PDFPage;
  let y = 0;

  const drawHeader = (continued = false) => {
    page = pdf.addPage([pageW, pageH]);
    page.drawRectangle({
      x: margin,
      y: pageH - 117,
      width: contentW,
      height: 82,
      color: wash,
      borderColor: rule,
      borderWidth: 0.8
    });

    const logoScale = Math.min(54 / logo.width, 54 / logo.height);
    const logoW = logo.width * logoScale;
    const logoH = logo.height * logoScale;
    page.drawImage(logo, { x: 45, y: pageH - 101 - logoH, width: logoW, height: logoH });

    const textX = 45 + logoW + 12;
    const badgeX = 430;
    const mastheadWidth = badgeX - textX - 10;
    const schoolName = "MARY ROYAL PRIMARY & JUNIOR SCHOOL";
    page.drawText(schoolName, {
      x: textX,
      y: pageH - 57,
      size: fitSize(schoolName, bold, 13, 10, mastheadWidth),
      font: bold,
      color: navy
    });

    const contact = "P.O. Box 40100, Kisumu, Kenya  |  Tel: +254 718 216 374";
    page.drawText(contact, {
      x: textX,
      y: pageH - 74,
      size: fitSize(contact, font, 7.5, 6.5, mastheadWidth),
      font,
      color: slate
    });
    const email = "Email: maryroyalschool81@gmail.com";
    page.drawText(email, {
      x: textX,
      y: pageH - 88,
      size: fitSize(email, font, 7.5, 6.5, mastheadWidth),
      font,
      color: navy
    });

    page.drawRectangle({ x: badgeX, y: pageH - 101, width: 118, height: 53, color: blue });
    page.drawText(continued ? "CBE REPORT" : "CBE PROGRESS REPORT", {
      x: badgeX + 8,
      y: pageH - 63,
      size: fitSize(continued ? "CBE REPORT" : "CBE PROGRESS REPORT", bold, 7.2, 6.2, 102),
      font: bold,
      color: white
    });
    page.drawText(pdfText(input.term).toUpperCase(), {
      x: badgeX + 8,
      y: pageH - 81,
      size: fitSize(pdfText(input.term).toUpperCase(), bold, 10, 7, 102),
      font: bold,
      color: white
    });
    page.drawText(`ADM: ${pdfText(input.learner.admissionNo)}`, {
      x: badgeX + 8,
      y: pageH - 94,
      size: fitSize(`ADM: ${pdfText(input.learner.admissionNo)}`, font, 7.2, 6.2, 102),
      font,
      color: white
    });

    if (continued) {
      page.drawText("Assessment results continued", {
        x: margin,
        y: pageH - 137,
        size: 8,
        font,
        color: slate
      });
      y = pageH - 152;
    } else {
      page.drawRectangle({ x: margin, y: pageH - 148, width: contentW, height: 22, color: navy });
      page.drawText("CBE LEARNING PROGRESS REPORT", {
        x: margin + 10,
        y: pageH - 141,
        size: 9,
        font: bold,
        color: white
      });
      y = pageH - 161;
    }
  };

  const drawFooter = () => {
    page.drawLine({
      start: { x: margin, y: 42 },
      end: { x: pageW - margin, y: 42 },
      thickness: 0.6,
      color: rule
    });
    page.drawText(`Mary Royal Primary & Junior School  |  Generated ${timestamp} EAT`, {
      x: margin,
      y: 29,
      size: 7,
      font,
      color: slate
    });
  };

  drawHeader();

  page.drawRectangle({
    x: margin,
    y: y - 45,
    width: contentW,
    height: 45,
    color: white,
    borderColor: rule,
    borderWidth: 0.8
  });
  page.drawText("LEARNER", { x: margin + 10, y: y - 14, size: 6.8, font: bold, color: slate });
  const learnerName = pdfText(input.learner.name);
  page.drawText(learnerName, {
    x: margin + 10,
    y: y - 27,
    size: fitSize(pdfText(input.learner.name), bold, 9.5, 7, 240),
    font: bold,
    color: navy
  });
  page.drawText("CLASS / GRADE", { x: 315, y: y - 14, size: 6.8, font: bold, color: slate });
  const learnerGrade = pdfText(input.learner.grade);
  page.drawText(learnerGrade, {
    x: 315,
    y: y - 27,
    size: fitSize(pdfText(input.learner.grade), bold, 9, 7, 210),
    font: bold,
    color: navy
  });
  y -= 57;

  const rubricHeight = 72;
  page.drawRectangle({
    x: margin,
    y: y - rubricHeight,
    width: contentW,
    height: rubricHeight,
    color: wash,
    borderColor: rule,
    borderWidth: 0.8
  });
  page.drawText("ASSESSMENT RUBRIC", {
    x: margin + 10,
    y: y - 14,
    size: 7.5,
    font: bold,
    color: navy
  });

  const rubric = CBC_LEVEL_BANDS.map(({ code, min, maxExclusive }) => ({
    code,
    text: maxExclusive === null ? `${min}-100%` : `${min}-<${maxExclusive}%`,
  }));
  const columns = [margin + 10, margin + 270];
  for (const [index, item] of rubric.entries()) {
    const row = Math.floor(index / 2);
    const column = index % 2;
    const itemY = y - 29 - row * 11;
    page.drawText(item.code, {
      x: columns[column],
      y: itemY,
      size: 7.5,
      font: bold,
      color: blue
    });
    page.drawText(item.text, {
      x: columns[column] + 27,
      y: itemY,
      size: 7.2,
      font,
      color: navy
    });
  }
  y -= rubricHeight + 13;

  const columnsLayout = {
    subject: margin + 9,
    score: margin + 202,
    level: margin + 258,
    comment: margin + 322
  };
  const headerHeight = 20;
  page.drawRectangle({
    x: margin,
    y: y - headerHeight,
    width: contentW,
    height: headerHeight,
    color: blue
  });
  page.drawText("LEARNING AREA", { x: columnsLayout.subject, y: y - 13, size: 7.2, font: bold, color: white });
  page.drawText("SCORE", { x: columnsLayout.score, y: y - 13, size: 7.2, font: bold, color: white });
  page.drawText("LEVEL", { x: columnsLayout.level, y: y - 13, size: 7.2, font: bold, color: white });
  page.drawText("TEACHER COMMENT", { x: columnsLayout.comment, y: y - 13, size: 7.2, font: bold, color: white });
  y -= headerHeight;

  let totalScore = 0;
  for (const [index, assessment] of input.assessments.entries()) {
    const comment = pdfText(assessment.comment?.trim() || "No comment recorded.");
    const commentLines = wrapText(comment, font, 7.1, 192);
    const rowHeight = Math.max(25, commentLines.length * 9 + 12);
    if (y - rowHeight < contentBottom + 24) {
      drawFooter();
      drawHeader(true);
      page.drawRectangle({
        x: margin,
        y: y - headerHeight,
        width: contentW,
        height: headerHeight,
        color: blue
      });
      page.drawText("LEARNING AREA", { x: columnsLayout.subject, y: y - 13, size: 7.2, font: bold, color: white });
      page.drawText("SCORE", { x: columnsLayout.score, y: y - 13, size: 7.2, font: bold, color: white });
      page.drawText("LEVEL", { x: columnsLayout.level, y: y - 13, size: 7.2, font: bold, color: white });
      page.drawText("TEACHER COMMENT", { x: columnsLayout.comment, y: y - 13, size: 7.2, font: bold, color: white });
      y -= headerHeight;
    }

    page.drawRectangle({
      x: margin,
      y: y - rowHeight,
      width: contentW,
      height: rowHeight,
      color: index % 2 === 0 ? white : wash,
      borderColor: rule,
      borderWidth: 0.5
    });
    const subject = pdfText(assessment.subject);
    page.drawText(subject, {
      x: columnsLayout.subject,
      y: y - 15,
      size: fitSize(subject, bold, 8, 6.4, 184),
      font: bold,
      color: navy
    });
    page.drawText(`${Math.round(assessment.score)}%`, {
      x: columnsLayout.score,
      y: y - 15,
      size: 8,
      font: bold,
      color: navy
    });
    page.drawText(cbcLevel(assessment.score), {
      x: columnsLayout.level,
      y: y - 15,
      size: 8,
      font: bold,
      color: navy
    });
    for (const [lineIndex, line] of commentLines.entries()) {
      page.drawText(line, {
        x: columnsLayout.comment,
        y: y - 14 - lineIndex * 9,
        size: 7.1,
        font,
        color: slate
      });
    }
    totalScore += assessment.score;
    y -= rowHeight;
  }

  if (input.assessments.length === 0) {
    page.drawRectangle({
      x: margin,
      y: y - 34,
      width: contentW,
      height: 34,
      color: wash,
      borderColor: rule,
      borderWidth: 0.5
    });
    page.drawText("No released assessment results are available for this term.", {
      x: margin + 10,
      y: y - 21,
      size: 8,
      font,
      color: slate
    });
    y -= 34;
  } else {
    const mean = Math.round(totalScore / input.assessments.length);
    if (y - 35 < contentBottom + 24) {
      drawFooter();
      drawHeader(true);
    }
    page.drawRectangle({
      x: margin,
      y: y - 35,
      width: contentW,
      height: 35,
      color: wash,
      borderColor: rule,
      borderWidth: 0.8
    });
    page.drawText(`Learning areas: ${input.assessments.length}`, {
      x: margin + 10,
      y: y - 21,
      size: 8,
      font,
      color: navy
    });
    page.drawText(`Term mean: ${mean}%`, {
      x: margin + 205,
      y: y - 21,
      size: 9,
      font: bold,
      color: navy
    });
    page.drawText(`Overall CBE level: ${cbcLevel(mean)}`, {
      x: margin + 365,
      y: y - 21,
      size: 8,
      font: bold,
      color: navy
    });
  }

  drawFooter();
  return pdf.save();
}


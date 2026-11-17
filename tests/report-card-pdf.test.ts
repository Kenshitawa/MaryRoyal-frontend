import { readFile } from "node:fs/promises";
import { join } from "node:path";
import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildReportCardPdf } from "../src/lib/report-card-pdf";

function extractText(bytes: Uint8Array) {
  const raw = Buffer.from(bytes).toString("latin1");
  const lines: string[] = [];
  let index = 0;
  while (true) {
    const start = raw.indexOf("stream", index);
    if (start < 0) break;
    let dataStart = start + 6;
    if (raw[dataStart] === "\r") dataStart += 1;
    if (raw[dataStart] === "\n") dataStart += 1;
    const end = raw.indexOf("endstream", dataStart);
    if (end < 0) break;
    try {
      const chunk = zlib.inflateSync(Buffer.from(bytes.subarray(dataStart, end))).toString("latin1");
      for (const match of chunk.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
        lines.push(Buffer.from(match[1], "hex").toString("latin1"));
      }
    } catch {
      // Some streams contain image data rather than text.
    }
    index = end + 9;
  }
  return lines.join("\n");
}

describe("CBE report card PDF", () => {
  it("uses a compact rubric layout and prints the full school contact without unsupported claims", async () => {
    const logoBytes = await readFile(join(process.cwd(), "public", "mary-royal-logo.png"));
    const bytes = await buildReportCardPdf({
      learner: {
        name: "Wanjiku O'Brien",
        admissionNo: "MR-0001",
        grade: "Grade 4"
      },
      term: "Term 2 2026",
      assessments: [
        { subject: "Mathematics", score: 85, comment: "Confident with fractions and problem solving." },
        { subject: "English", score: 68, comment: null }
      ],
      generatedAt: new Date("2026-11-06T12:00:00Z"),
      logoBytes
    });

    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain("CBE Progress Report");

    const text = extractText(bytes);
    expect(text).toContain("MARY ROYAL PRIMARY & JUNIOR SCHOOL");
    expect(text).toContain("maryroyalschool81@gmail.com");
    expect(text).toContain("CBE LEARNING PROGRESS REPORT");
    expect(text).toContain("ASSESSMENT RUBRIC");
    expect(text).toContain("EE");
    expect(text).toContain("Confident with fractions and problem solving.");
    expect(text).toContain("No comment recorded.");
    expect(text).not.toContain("CBC");
    expect(text).not.toContain("Slogan");
    expect(text).not.toContain("Obunga");
    expect(text).not.toContain("Nurturing Excellence");
    expect(text).not.toContain("Scan to verify");
    expect(text).not.toContain("Outstanding");
  });
});

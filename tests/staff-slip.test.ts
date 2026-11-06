import zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildStaffSlipPdf } from "../src/lib/staff-slip-pdf";

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
    } catch {}
    index = end + 9;
  }
  return lines.join("\n");
}

describe("Staff slip PDF", () => {
  it("renders a branded credential slip with every recorded section", async () => {
    const bytes = await buildStaffSlipPdf({
      name: "Wanjiku O’Brien",
      role: "TEACHER",
      staffNumber: "MR-STAFF-0001",
      tscNumber: "",
      department: "Academics",
      employmentType: "Permanent",
      phone: "+254712345678",
      county: "Kisumu",
      email: "wanjiku@maryroyal.ac.ke",
      temporaryPassword: "Test-Only-Pass-123",
      classTeacherGrade: "Grade 4",
      assignments: [{ grade: "Grade 4", subject: "Mathematics" }],
      generatedAt: new Date("2026-11-06T12:00:00Z")
    });

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toContain("MR-STAFF-0001");

    const text = extractText(bytes);
    expect(text).toContain("MARY ROYAL PRIMARY & JUNIOR SCHOOL");
    expect(text).toContain("STAFF RECORD & SIGN-IN CREDENTIALS");
    expect(text).toContain("Wanjiku O'Brien");
    expect(text).toContain("wanjiku@maryroyal.ac.ke");
    expect(text).toContain("Test-Only-Pass-123");
    expect(text).toContain("Grade 4: Mathematics");
    expect(text).toContain("Not provided");
    expect(text).not.toContain("undefined");
  });
});

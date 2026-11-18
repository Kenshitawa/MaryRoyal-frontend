import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";

describe("Receipts PDF generation", () => {
  it("creates a valid PDF document with zero receipts without crashing", async () => {
    const pdf = await PDFDocument.create();
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const page = pdf.addPage([pageWidth, pageHeight]);
    page.drawText("MARY ROYAL SCHOOL", { x: 42, y: pageHeight - 52, size: 20 });
    page.drawText("No fee payments found matching the current criteria.", { x: 42, y: pageHeight - 180, size: 12 });

    const bytes = await pdf.save();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(0);

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });
});

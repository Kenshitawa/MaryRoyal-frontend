"use client";

import { Printer, Download } from "lucide-react";

export function PrintButton({ receiptId, receiptNo }: { receiptId?: string; receiptNo?: string }) {
  const filename = receiptNo
    ? `Mary-Royal-Receipt-${receiptNo.replace(/[^a-zA-Z0-9._-]/g, "-")}.pdf`
    : undefined;
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="btn btn-secondary text-xs shadow-xs transition hover:scale-[1.02] active:scale-[0.98]"
      >
        <Printer size={15} className="text-blue-600 dark:text-blue-400" />
        Print Receipt
      </button>

      {receiptId && (
        <a
          href={`/api/finance/payments/${receiptId}/pdf`}
          download={filename}
          className="btn btn-primary text-xs shadow-sm transition hover:scale-[1.02] active:scale-[0.98]"
        >
          <Download size={15} />
          Download PDF
        </a>
      )}
    </div>
  );
}

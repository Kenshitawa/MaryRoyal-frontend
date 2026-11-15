"use client";

import { RiDownloadLine, RiPrinterLine } from "@remixicon/react";
import { Button, ButtonLink } from "@/components/base/buttons/button";

export function PrintButton({ receiptId }: { receiptId?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
      <Button
        type="button"
        onClick={() => window.print()}
        variant="secondary"
        size="small"
        leadingIcon={RiPrinterLine}
        className="min-h-11"
      >
        Print Receipt
      </Button>

      {receiptId && (
        <ButtonLink
          href={`/api/finance/payments/${receiptId}/pdf`}
          download={`receipt-${receiptId}.pdf`}
          variant="primary"
          size="small"
          leadingIcon={RiDownloadLine}
          className="min-h-11"
        >
          Download PDF
        </ButtonLink>
      )}
    </div>
  );
}

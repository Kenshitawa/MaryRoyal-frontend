"use client";

import { useState } from "react";
import { RiInformationFill } from "@remixicon/react";
import { Focusable } from "react-aria-components";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";

/** Bare info glyph with a tooltip — the footer header's trailing control.
 *  Opens on hover and focus as tooltips do, and on click as well, since a
 *  glyph this small reads as a button and gets tapped. */
export function StatHint({ label, hint }: { label: string; hint: string }) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipTrigger delay={200} isOpen={open} onOpenChange={setOpen}>
      <Focusable>
        <button
          type="button"
          aria-label={`About ${label}`}
          onClick={() => setOpen((isOpen) => !isOpen)}
          className="flex shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground-icon-secondary outline-none transition-colors duration-150 ease hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <RiInformationFill className="size-5" aria-hidden />
        </button>
      </Focusable>
      <Tooltip size="md">{hint}</Tooltip>
    </TooltipTrigger>
  );
}

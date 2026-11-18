import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";
import { SpinnerGlyph } from "@/components/base/spinner/spinner";
import { cx } from "@/utils/cx";

/* ------------------------------------------------------------------ */
/* Royal loader                                                        */
/*                                                                     */
/* One loading language for every role: a comet band orbiting the      */
/* school crest, with a soft beacon behind it. The band is the same    */
/* BoardUI spinner used on buttons, scaled up so waits on data and     */
/* route transitions feel like part of the same system.                */
/* ------------------------------------------------------------------ */

export type LoaderSize = "sm" | "md" | "lg";

const MARKS: Record<LoaderSize, { ring: number; glyph: number }> = {
  sm: { ring: 32, glyph: 13 },
  md: { ring: 48, glyph: 19 },
  lg: { ring: 64, glyph: 26 },
};

export function Loader({
  label = "Loading…",
  size = "md",
  showLabel = true,
  className,
}: {
  /** Announced to assistive technology, and shown unless `showLabel` is false. */
  label?: string;
  size?: LoaderSize;
  showLabel?: boolean;
  className?: string;
}) {
  const mark = MARKS[size];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cx("inline-flex flex-col items-center justify-center gap-2.5 text-center", className)}
    >
      <span
        aria-hidden="true"
        className="loader-mark"
        style={{ width: mark.ring, height: mark.ring }}
      >
        <span className="loader-halo" />
        <SpinnerGlyph size={mark.ring} className="absolute inset-0 text-accent-500" />
        <span className="loader-disc">
          <GraduationCap size={mark.glyph} strokeWidth={2.1} />
        </span>
      </span>
      {showLabel ? (
        <span className="text-body-2-medium text-text-secondary">{label}</span>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </span>
  );
}

/** Full-panel wait state: crest loader, label and an optional hint line. */
export function LoadingState({
  label = "Loading…",
  hint,
  className,
  children,
}: {
  label?: string;
  hint?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx(
        "flex min-h-44 flex-col items-center justify-center gap-3 px-4 py-10 text-center",
        className,
      )}
    >
      <Loader label={label} />
      {hint ? <p className="max-w-sm text-body-2-regular text-text-tertiary">{hint}</p> : null}
      {children}
    </div>
  );
}

/** Compact inline wait, e.g. a roster or a table body still fetching. */
export function InlineLoader({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cx("inline-flex items-center gap-2 text-body-2-regular text-text-secondary", className)}
    >
      <SpinnerGlyph size={18} className="text-accent-500" />
      <span>{label}</span>
    </span>
  );
}

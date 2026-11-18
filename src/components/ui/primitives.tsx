import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */
export function Card({
  children,
  className = "",
  title,
  description,
  action,
  padded = true,
  as: Tag = "section",
  id,
}: {
  children?: ReactNode;
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  padded?: boolean;
  as?: "section" | "article" | "div";
  id?: string;
}) {
  return (
    <Tag id={id} className={`card min-w-0 ${padded ? "card-pad" : ""} ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="section-title break-words">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-ink-2">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Page header                                                         */
/* ------------------------------------------------------------------ */
export function PageHeader({
  title,
  help,
  action,
  meta,
}: {
  title: ReactNode;
  help?: ReactNode;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="page-head animate-boardui-in">
      {meta ? <div className="meta">{meta}</div> : null}
      <div className="page-head-row">
        <div className="min-w-0">
          <h1 className="page-title break-words">{title}</h1>
          {help ? <p className="page-help mt-1 text-xs">{help}</p> : null}
        </div>
        {action ? <div className="flex min-w-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */
export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone = "brand",
  href,
  progress,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon?: LucideIcon;
  tone?: "brand" | "success" | "warning" | "danger" | "neutral";
  href?: string;
  /** Optional 0–100 meter drawn under the value. */
  progress?: number;
}) {
  const tones: Record<string, string> = {
    brand: "bg-status-blue-background text-status-blue-text dark:bg-blue-500/20 dark:text-blue-300 dark:border dark:border-blue-400/30",
    success: "bg-status-lime-background text-status-lime-text dark:bg-emerald-500/20 dark:text-emerald-300 dark:border dark:border-emerald-400/30",
    warning: "bg-status-yellow-background text-status-yellow-text dark:bg-amber-500/20 dark:text-amber-300 dark:border dark:border-amber-400/30",
    danger: "bg-status-rose-background text-status-rose-text dark:bg-rose-500/20 dark:text-rose-300 dark:border dark:border-rose-400/30",
    neutral: "bg-status-purple-background text-status-purple-text dark:bg-purple-500/20 dark:text-purple-300 dark:border dark:border-purple-400/30",
  };
  const body = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 text-caption-1-semibold text-text-secondary dark:text-slate-300">{label}</p>
        {Icon ? (
          <span className={cx("grid size-8 shrink-0 place-items-center rounded-xl", tones[tone])} aria-hidden="true">
            <Icon size={15} strokeWidth={2} />
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 break-words text-title-2-medium tabular-nums text-text-primary dark:text-white">{value}</p>
      {typeof progress === "number" ? (
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background-tertiary-default"
          role="progressbar"
          aria-label={`${label} progress`}
          aria-valuenow={Math.max(0, Math.min(100, Math.round(progress)))}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${Math.max(0, Math.min(100, progress))}%`,
              background: "var(--dashboard-tone)",
            }}
          />
        </div>
      ) : null}
      {note ? <p className="mt-0.5 text-body-2-regular text-text-secondary dark:text-slate-300/90">{note}</p> : null}
    </>
  );
  const className = cx(
    "dashboard-stat min-w-0 rounded-3xl border border-border-button-default bg-background-primary-default p-3.5 shadow-xs transition-colors duration-150 sm:p-4",
    href && "hover:border-accent-300 active:bg-background-primary-active",
    href && "outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring",
  );
  return href ? (
    <a href={href} data-dashboard-tone={tone} className={`${className} block no-underline hover:border-brand-line`}>
      {body}
    </a>
  ) : (
    <div data-dashboard-tone={tone} className={className}>{body}</div>
  );
}

/* ------------------------------------------------------------------ */
/* List row                                                            */
/* ------------------------------------------------------------------ */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  href,
  className = "",
  as,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  href?: string;
  className?: string;
  as?: "div" | "li";
}) {
  const Tag = href ? "a" : as ?? "div";
  const content = (
    <>
      {leading ? <span className="shrink-0">{leading}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-semibold text-ink">{title}</span>
        {subtitle ? <span className="mt-0.5 block truncate text-[11px] text-ink-2">{subtitle}</span> : null}
      </span>
      {trailing ? <span className="flex shrink-0 items-center gap-2">{trailing}</span> : null}
    </>
  );
  return (
    <Tag {...(href ? { href } : {})} className={`list-row ${className}`}>
      {content}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state / skeleton                                              */
/* ------------------------------------------------------------------ */
export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-state">
      {Icon ? (
        <span className="mb-1 grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand-ink" aria-hidden="true">
          <Icon size={18} />
        </span>
      ) : null}
      <p className="empty-state-title">{title}</p>
      {description ? <p className="empty-state-text">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="list" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <div className="card flex items-center gap-3 p-3" key={index}>
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form step                                                           */
/* ------------------------------------------------------------------ */
export function FormStep({
  step,
  total,
  title,
  description,
  children,
  footer,
}: {
  step: number;
  total: number;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="card card-pad">
      <div className="mb-3">
        <p className="meta">
          Step {step} of {total}
        </p>
        <div className="mt-2 flex gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step} aria-label={`Step ${step} of ${total}`}>
          {Array.from({ length: total }).map((_, index) => (
            <span key={index} className={`h-1 flex-1 rounded-full ${index < step ? "bg-brand" : "bg-surface-3"}`} />
          ))}
        </div>
        <h2 className="mt-3 text-title font-semibold text-ink">{title}</h2>
        {description ? <p className="mt-1 text-label text-ink-2">{description}</p> : null}
      </div>
      <div className="space-y-3">{children}</div>
      {footer ? <div className="action-bar">{footer}</div> : null}
    </div>
  );
}

export function BottomActionBar({ children }: { children: ReactNode }) {
  return <div className="action-bar">{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Section title                                                       */
/* ------------------------------------------------------------------ */
export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="section-title">{children}</h2>
      {action}
    </div>
  );
}

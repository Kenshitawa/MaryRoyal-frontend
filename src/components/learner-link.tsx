import React from "react";
import Image from "next/image";

interface LearnerLinkProps {
  id: string;
  name?: string;
  admissionNo?: string;
  className?: string;
  showAdmissionNo?: boolean;
  disabled?: boolean;
  subtext?: string;
}

/**
 * R11: Reusable LearnerLink component.
 * Renders clickable name and admission number pointing to /learners/[id].
 * If disabled (unauthorized role), renders clean non-clickable text.
 */
export function LearnerLink({
  id,
  name,
  admissionNo,
  className = "",
  showAdmissionNo = true,
  disabled = false,
  subtext
}: LearnerLinkProps) {
  if (disabled) {
    return (
      <span className={`inline-flex flex-col text-slate-700 dark:text-slate-300 ${className}`}>
        {name && <span className="font-semibold">{name}</span>}
        {admissionNo && showAdmissionNo && (
          <span className="font-mono text-[11px] text-slate-500">{admissionNo}</span>
        )}
        {subtext && <span className="text-[11px] text-slate-400">{subtext}</span>}
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-col ${className}`}>
      {name && (
        <a
          href={`/learners/${id}`}
          className="group inline-flex items-center gap-1 font-bold text-blue-700 transition hover:text-blue-900 hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <span>{name}</span>
        </a>
      )}
      {admissionNo && showAdmissionNo && (
        <a
          href={`/learners/${id}`}
          className="inline-block font-mono text-[11px] text-slate-500 transition hover:text-blue-700 dark:text-slate-400 dark:hover:text-blue-300"
        >
          {admissionNo}
        </a>
      )}
      {subtext && <span className="text-[11px] text-slate-400">{subtext}</span>}
    </div>
  );
}

interface LearnerChipProps {
  id: string;
  name: string;
  admissionNo?: string;
  grade?: string;
  photoUrl?: string | null;
  className?: string;
  disabled?: boolean;
}

/**
 * R11: LearnerChip variant with avatar + name + admission number.
 */
export function LearnerChip({
  id,
  name,
  admissionNo,
  grade,
  photoUrl,
  className = "",
  disabled = false
}: LearnerChipProps) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const content = (
    <div className={`inline-flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-2.5 py-1.5 shadow-sm backdrop-blur transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-blue-800 ${className}`}>
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt={name}
          width={28}
          height={28}
          unoptimized
          sizes="28px"
          className="h-7 w-7 rounded-lg object-cover"
        />
      ) : (
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-100 text-xs font-black text-blue-800 dark:bg-blue-950 dark:text-blue-300">
          {initials}
        </span>
      )}
      <div className="flex flex-col text-left">
        <span className="text-xs font-bold text-slate-900 dark:text-white">{name}</span>
        <span className="text-[10px] text-slate-500 dark:text-slate-400">
          {admissionNo ? `${admissionNo} ` : ""}
          {grade ? `· ${grade}` : ""}
        </span>
      </div>
    </div>
  );

  if (disabled) {
    return content;
  }

  return (
    <a
      href={`/learners/${id}`}
      className="inline-block transition-transform hover:-translate-y-0.5 focus-visible:rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      {content}
    </a>
  );
}

import Link from "next/link";
import { GraduationCap, ShieldAlert } from "lucide-react";

const COPY = {
  "no-school": {
    title: "Choose a school portal",
    body: "This address is the platform root. Open your school's own subdomain to sign in.",
  },
  "not-found": {
    title: "School portal not found",
    body: "This address does not match an active school. Check the subdomain, or contact your school administrator.",
  },
  suspended: {
    title: "School portal suspended",
    body: "This school's portal is temporarily unavailable. Please contact your school administrator.",
  },
  "tenant-mismatch": {
    title: "Wrong school portal",
    body: "Your signed-in session belongs to a different school. Sign in on this school's own subdomain.",
  },
} as const;

export type TenantStatusReason = keyof typeof COPY;

export function TenantStatusPage({ reason, name }: { reason: TenantStatusReason; name?: string }) {
  const copy = COPY[reason];
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5 dark:bg-slate-950">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
          {reason === "suspended" ? <ShieldAlert size={28} aria-hidden="true" /> : <GraduationCap size={28} aria-hidden="true" />}
        </div>
        <p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-teal-700 dark:text-teal-300">
          {name ?? "School Core"}
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">{copy.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{copy.body}</p>
        {reason === "tenant-mismatch" && (
          <Link
            href="/"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Sign in on this portal
          </Link>
        )}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";

export default function StaffError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bento-card w-full rounded-3xl p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Staff pages could not load</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Please try again. If the problem continues, return to your dashboard.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => reset()} className="min-h-11 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Try again</button>
          <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100">Dashboard</Link>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";

export default function StaffNotFound() {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="bento-card w-full rounded-3xl p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Staff record not found</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">The profile may have been archived or the link may be out of date.</p>
        <Link href="/staff" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white hover:bg-blue-800">Back to staff directory</Link>
      </div>
    </section>
  );
}

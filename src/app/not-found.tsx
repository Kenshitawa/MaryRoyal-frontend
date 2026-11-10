import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-5 dark:bg-slate-950">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-bold uppercase tracking-widest text-blue-700">School Portal</p>
        <p className="mt-5 text-6xl font-black text-blue-800 dark:text-blue-300">404</p>
        <h1 className="mt-3 text-2xl font-extrabold text-slate-950 dark:text-white">We could not find that page</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          The page may have moved, or the record may not be available to your account.
        </p>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}

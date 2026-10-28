export default function StaffLoading() {
  return <main className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6" aria-busy="true" aria-label="Loading staff">
    <div className="h-7 w-40 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
    <div className="h-12 w-full max-w-md animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900" />)}</div>
  </main>;
}

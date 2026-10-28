export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50 p-4 pb-24 dark:bg-slate-950 sm:p-6" aria-busy="true" aria-live="polite">
      {/* Top Header Skeleton */}
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
            <div className="space-y-1.5">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-3 w-20 animate-pulse rounded bg-slate-200/70 dark:bg-slate-800/70" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>

        {/* Title Bar Skeleton */}
        <div className="mt-6 mb-5 space-y-2">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          <div className="h-4 w-64 animate-pulse rounded bg-slate-200/70 dark:bg-slate-800/70" />
        </div>

        {/* Bento Cards Skeleton */}
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-4 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-7 w-7 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
              </div>
              <div className="h-8 w-20 animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800/80 my-2" />
              <div className="h-3 w-36 animate-pulse rounded bg-slate-100 dark:bg-slate-800/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

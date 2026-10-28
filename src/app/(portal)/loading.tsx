import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-3">
      <div className="page-head">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card card-pad space-y-3">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3.5 w-32" />
          </div>
        ))}
      </div>
      <div className="card divide-y divide-line-soft">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex min-h-14 items-center gap-3 px-4 py-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

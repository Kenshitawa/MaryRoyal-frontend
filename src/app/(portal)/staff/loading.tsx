import { Skeleton } from "@/components/ui/primitives";
import { Loader } from "@/components/ui/loader";

export default function StaffLoading() {
  return (
    <section
      className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6"
      aria-busy="true"
      aria-label="Loading staff"
    >
      <div className="flex items-center gap-2.5">
        <Loader size="sm" showLabel={false} label="Loading staff directory" />
        <span className="text-caption-1-semibold text-text-tertiary">Loading the staff directory…</span>
      </div>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-12 w-full max-w-md rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-3 rounded-2xl border border-border-button-default bg-background-primary-default p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    </section>
  );
}

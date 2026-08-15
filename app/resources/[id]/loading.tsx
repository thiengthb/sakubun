import { PageSkeleton, TabbedSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageSkeleton>
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="size-7 shrink-0 rounded-md" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-5 w-10 rounded-md" />
          <Skeleton className="h-5 w-20 rounded-md" />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-24 rounded-md" />
        <Skeleton className="h-6 w-8 rounded-md" />
      </div>

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 items-center gap-1 rounded-lg bg-muted p-[3px] max-md:w-full md:w-[198px]">
            <Skeleton className="h-full flex-1 rounded-md" />
            <Skeleton className="h-full flex-1 rounded-md" />
          </div>
          <div className="hidden gap-2 md:ml-auto md:flex">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>

        <TabbedSkeleton
          storeKey="item.tab"
          initial="stats"
          shapes={{
            stats: (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }, (_, i) => (
                    <Skeleton key={i} className="h-[74px] rounded-xl sm:h-[86px]" />
                  ))}
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-44" />
                  <Skeleton className="h-64 rounded-xl" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-48 rounded-xl" />
                </div>
              </div>
            ),
            detail: (
              <div className="space-y-4">
                <Skeleton className="h-72 rounded-xl" />
                <Skeleton className="h-40 rounded-xl" />
              </div>
            ),
          }}
        />
      </div>
    </PageSkeleton>
  );
}

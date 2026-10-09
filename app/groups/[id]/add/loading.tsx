import { FitList, PageSkeleton } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageSkeleton width="narrow" section="groups" action="addItems">
      <div className="flex flex-col gap-4 sm:min-h-[calc(100svh-13rem)]">
        <Skeleton className="h-5 w-full max-w-sm max-md:h-9" />
        <div className="flex flex-col gap-3 rounded-xl bg-card py-4 ring-1 ring-foreground/10">
          <div className="flex flex-row items-center gap-2 px-4 sm:gap-3">
            <Skeleton className="h-8 min-w-0 flex-1 rounded-lg sm:max-w-xs" />
            <Skeleton className="ml-auto h-4 w-12 shrink-0" />
          </div>
          <FitList
            rowHeight={71}
            fallback={6}
            className="divide-y divide-border border-y border-border"
            item={
              <div data-skeleton-row className="flex items-center gap-3 px-4" style={{ height: 71 }}>
                <Skeleton className="size-4 shrink-0 rounded" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <Skeleton className="h-3 w-52" />
                </div>
              </div>
            }
          />
          <div className="flex items-center gap-2 px-4">
            <Skeleton className="h-4 w-20" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-8 w-28 rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </PageSkeleton>
  );
}

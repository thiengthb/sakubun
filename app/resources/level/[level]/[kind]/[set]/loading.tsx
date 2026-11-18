import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// A set of a level (U4c3): the legend, then the map of its words beside the open word.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={
        <ParentCrumbs section="resources" self record={{ label: 'N5 · Từ vựng', pending: true }} />
      }
      title={<SkeletonText text="Chặng 1" />}
      meta={<Skeleton className="h-3 w-56" />}
    >
      <div className="flex flex-col gap-4">
        <Skeleton className="h-4 w-72" />
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {Array.from({ length: 20 }, (_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg md:h-20" />
            ))}
          </div>
          <Skeleton className="h-56 rounded-xl max-md:hidden" />
        </div>
      </div>
    </PageSkeleton>
  );
}

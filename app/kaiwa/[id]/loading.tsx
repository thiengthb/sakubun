import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/core/utils';

// The script's title is the h1, which only the loaded script knows; then the toolbar (Tôi là, Ẩn
// nghĩa, Che câu của tôi) and the lines as chat bubbles, each run headed by its speaker's name.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="kaiwa" self />}
      title={<SkeletonText text="Ở nhà hàng" />}
      meta
      actions={
        <>
          <Skeleton className="h-9 w-16 rounded-sm md:w-7 md:h-7" />
          <Skeleton className="h-9 w-28 rounded-sm md:w-7 md:h-7" />
          <Skeleton className="size-9 rounded-sm md:size-7" />
        </>
      }
      actionsOnPhone="split"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2">
          <Skeleton className="h-9 w-48 rounded-sm md:h-7" />
          <Skeleton className="h-9 w-52 rounded-sm md:h-7" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className={cn('flex flex-col gap-1 pt-1', i % 2 === 1 ? 'items-end' : 'items-start')}
            >
              <Skeleton className="mx-3 h-3 w-12" />
              <Skeleton className="h-16 w-5/6 rounded-2xl md:w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}

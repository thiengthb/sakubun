import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/core/utils';

// The script's title is the h1, which only the loaded script knows; then the part picker and the
// lines as chat bubbles, left and right.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="kaiwa" self />}
      title={<SkeletonText text="Ở nhà hàng" />}
      meta
      actions={
        <>
          <Skeleton className="h-9 w-24 rounded-sm md:h-7" />
          <Skeleton className="h-9 w-28 rounded-sm md:h-7" />
          <Skeleton className="h-9 w-16 rounded-sm md:h-7" />
        </>
      }
      actionsOnPhone="split"
    >
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-9 w-40 rounded-sm md:h-7" />
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className={cn('flex items-start gap-2', i % 2 === 1 && 'flex-row-reverse')}
            >
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <Skeleton className="h-16 w-3/4 rounded-2xl md:w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}

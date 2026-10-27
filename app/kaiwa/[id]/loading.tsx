import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// The script's title is the h1, which only the loaded script knows; then its lines as cards.
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
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-18 rounded-xl" />
        ))}
      </div>
    </PageSkeleton>
  );
}

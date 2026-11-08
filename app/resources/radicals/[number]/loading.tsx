import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// One radical (KJ7): its name, then the legend and its kanji as small tiles.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={
        <ParentCrumbs
          section="kanji"
          self
          record={{ label: 'Bộ thủ', href: '/resources/radicals' }}
        />
      }
      title={<SkeletonText text="Bộ 水 thủy" />}
      meta={<Skeleton className="h-3 w-64" />}
    >
      <div className="space-y-4" role="status" aria-label="Đang tải bộ thủ">
        <Skeleton className="h-4 w-72" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 30 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-16 rounded-xl" />
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}

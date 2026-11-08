import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { KANJI_GRID } from '@/components/common/kanji-tile';

// Bộ thủ (KJ7): the title, then the radicals by stroke count as tiles.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="kanji" self />}
      title={<SkeletonText text="Bộ thủ" />}
      meta={<Skeleton className="h-3 w-40" />}
    >
      <div className="@container space-y-2" role="status" aria-label="Đang tải bộ thủ">
        <Skeleton className="h-4 w-12" />
        <div className={KANJI_GRID}>
          {Array.from({ length: 24 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}

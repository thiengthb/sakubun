import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { KANJI_GRID } from '@/components/common/kanji-tile';

// A kanji group of Kho chung (KJ5): the level's name, "Lấy cả nhóm" on its own row on a phone, how
// much of it the learner has beside the search, then the tiles.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="library" self />}
      title={<SkeletonText text="N5 · Kanji" />}
      meta={<Skeleton className="h-3 w-32" />}
      actions={<Skeleton className="h-9 w-32 rounded-sm md:h-7" />}
      actionsOnPhone="split"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-48 flex-1 items-center gap-3">
            <Skeleton className="h-1.5 flex-1 rounded-full" />
            <Skeleton className="h-4 w-20 rounded-sm" />
          </div>
          <Skeleton className="h-9 w-full rounded-sm sm:w-64 md:h-7" />
        </div>
        <div className="@container" role="status" aria-label="Đang tải kanji">
          <div className={KANJI_GRID}>
            {Array.from({ length: 24 }, (_, i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </PageSkeleton>
  );
}

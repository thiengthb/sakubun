import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { CardsSkeleton, PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// The group's name is the h1, which only the loaded group knows; "Lấy cả nhóm" gets its own row on a
// phone; then how much of it the learner has beside the search, and its entries as cards.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="library" self />}
      title={<SkeletonText text="N5 · Ngữ pháp" />}
      meta={
        // The kind chip, then the size: LibraryGroupView's meta line.
        <div className="flex h-5 items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-sm" />
          <Skeleton className="h-3 w-12" />
        </div>
      }
      pageIcons={<Skeleton className="h-9 w-14 rounded-sm md:h-7" />}
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
        <CardsSkeleton rowHeight={96} footer={false} />
      </div>
    </PageSkeleton>
  );
}

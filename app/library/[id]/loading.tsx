import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { CardsSkeleton, PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// The group's name is the h1, which only the loaded group knows; then its entries as cards.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="library" self />}
      title={<SkeletonText text="N5 · Ngữ pháp" />}
      meta
      actions={<Skeleton className="h-9 w-32 rounded-sm md:h-7" />}
    >
      <CardsSkeleton rowHeight={96} footer={false} />
    </PageSkeleton>
  );
}

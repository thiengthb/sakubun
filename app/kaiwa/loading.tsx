import { CardsSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// KaiwaListView's shape: the count waits for data, then a grid of script cards.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      title="Hội thoại"
      meta
      actions={<Skeleton className="h-9 w-28 rounded-sm md:h-7" />}
    >
      <CardsSkeleton rowHeight={62} footer={false} />
    </PageSkeleton>
  );
}

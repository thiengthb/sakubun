import { CardsSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// KaiwaListView's shape: the count waits for data, then a grid of script cards (title, first line,
// facts).
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      title="Hội thoại"
      meta
      actions={
        <>
          <Skeleton className="h-9 w-28 rounded-sm md:h-7" />
          <Skeleton className="h-9 w-20 rounded-sm md:h-7" />
        </>
      }
      actionsOnPhone="split"
    >
      <CardsSkeleton rowHeight={96} footer={false} />
    </PageSkeleton>
  );
}

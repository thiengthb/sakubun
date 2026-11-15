import { CardsSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Kho's level board (U4b): five level cards and the one for what lies outside JLPT.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      title="Kho"
      meta
      actions={<Skeleton className="h-9 w-20 rounded-sm md:h-7" />}
    >
      <CardsSkeleton count={6} rowHeight={152} rowGap={12} columns="" footer={false} />
    </PageSkeleton>
  );
}

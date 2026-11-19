import { KhoTrail } from '@/components/layout/kho-trail';
import { ListSkeleton, PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// One source of "Ngoài JLPT" (U4e): a list of items.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<KhoTrail place={{ way: 'outside' }} />}
      title={<SkeletonText text="Claude soạn" />}
      meta={<Skeleton className="h-3 w-32" />}
      actions={<Skeleton className="h-9 w-20 rounded-sm md:h-7" />}
    >
      <ListSkeleton auto rowHeight={64} action={false} />
    </PageSkeleton>
  );
}

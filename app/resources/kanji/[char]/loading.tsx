import { KhoTrail } from '@/components/layout/kho-trail';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// A kanji's page (KJ6): the glyph and its facts in one card, then the network.
export default function Loading() {
  return (
    <PageSkeleton
      template="detail"
      trail={<KhoTrail place={{ way: 'kanji' }} />}
      title={<SkeletonText text="経 [KINH]" />}
      meta={<Skeleton className="h-3 w-40" />}
    >
      <div className="space-y-8">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    </PageSkeleton>
  );
}

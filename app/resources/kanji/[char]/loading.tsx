import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// A kanji's page (KJ6): the glyph and its facts in one card, then the network.
export default function Loading() {
  return (
    <PageSkeleton
      template="detail"
      trail={<ParentCrumbs section="kanji" self />}
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

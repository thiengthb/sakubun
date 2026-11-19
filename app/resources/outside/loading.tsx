import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { CardsSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// "Ngoài JLPT" (U4e): the groups, then the sources, each a row of cards.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="resources" self />}
      title="Ngoài JLPT"
      meta={<Skeleton className="h-3 w-56" />}
      actions={<Skeleton className="h-9 w-20 rounded-sm md:h-7" />}
    >
      <div className="flex flex-col gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-5 w-32" />
            <CardsSkeleton
              count={3}
              rowHeight={104}
              rowGap={12}
              columns="md:grid-cols-2 xl:grid-cols-3"
              footer={false}
            />
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}

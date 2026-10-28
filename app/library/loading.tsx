import { Skeleton } from '@/components/ui/skeleton';
import {
  CardsSkeleton,
  PageSkeleton,
  PageTabsSkeleton,
  TabbedSkeleton,
  ToolbarSkeleton,
} from '@/components/layout/page-skeleton';

// LibraryView's shape: OpenJLPT's level table over the learners' group cards (7.4h), or the search
// row over entry cards.
export default function Loading() {
  return (
    <PageSkeleton template="list" title="Kho chung" meta tabs={<PageTabsSkeleton set="library" />}>
      <TabbedSkeleton
        storeKey="library.tab"
        urlKey="tab"
        initial="groups"
        shapes={{
          groups: (
            <div className="space-y-6 md:space-y-8">
              <div className="space-y-3">
                <SectionSkeleton />
                <Skeleton className="h-77 rounded-xl" />
              </div>
              <div className="space-y-3">
                <SectionSkeleton />
                <CardsSkeleton rowHeight={96} footer={false} />
              </div>
            </div>
          ),
          items: (
            <>
              <ToolbarSkeleton filters={2} />
              <CardsSkeleton rowHeight={96} footer={false} />
            </>
          ),
        }}
      />
    </PageSkeleton>
  );
}

function SectionSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-4 w-36 rounded-sm" />
      <Skeleton className="h-3 w-64 max-w-full rounded-sm" />
    </div>
  );
}

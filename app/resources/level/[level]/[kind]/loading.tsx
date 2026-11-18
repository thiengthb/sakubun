import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { LeadPanel } from '@/components/common/lead-panel';
import {
  CardsSkeleton,
  PageSkeleton,
  PageTabsSkeleton,
  SkeletonText,
} from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// A level of Kho (U4c2): the view tabs (U4c4), "Bước tiếp theo" with its three actions, then the
// sets. A switch of view keeps the old view on screen instead (LevelTabs).
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="resources" self />}
      title={<SkeletonText text="N5 · Từ vựng" />}
      meta={<Skeleton className="h-3 w-48" />}
      tabs={<PageTabsSkeleton set="level" />}
    >
      <div className="flex flex-col gap-6">
        <LeadPanel className="p-4 md:p-4">
          <Skeleton className="h-4 w-28" />
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-[1.4fr_1fr_1fr] md:gap-3">
            <Skeleton className="col-span-2 h-14 rounded-lg md:col-span-1" />
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </div>
        </LeadPanel>
        <CardsSkeleton
          count={6}
          rowHeight={104}
          rowGap={12}
          columns="md:grid-cols-2 xl:grid-cols-3"
          footer={false}
        />
      </div>
    </PageSkeleton>
  );
}

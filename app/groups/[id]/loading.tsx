import {
  ListSkeleton,
  PageSkeleton,
  TabbedSkeleton,
  TabsAside,
  ToolbarSkeleton,
} from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

const LIST = (
  <div className="space-y-6">
    <ToolbarSkeleton action filters={2} />
    <ListSkeleton auto rows={6} rowHeight={64} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-64" />
    </div>
  </div>
);

const FLASHCARD = (
  <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="size-9 rounded-md" />
    </div>
    <Skeleton className="h-1.5 w-full rounded-full" />
    <div className="space-y-4 pt-1">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-24 w-full" />
    </div>
    <div className="flex gap-2.5 pt-2">
      <Skeleton className="h-14 w-24 rounded-md" />
      <Skeleton className="h-14 flex-1 rounded-md" />
    </div>
  </div>
);

export default function Loading() {
  return (
    <PageSkeleton aside={<TabsAside count={2} rail={178} select={126} />}>
      <TabbedSkeleton
        storeKey="group.tab"
        initial="list"
        shapes={{ list: LIST, flashcard: FLASHCARD }}
      />
    </PageSkeleton>
  );
}

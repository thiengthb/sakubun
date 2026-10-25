import {
  PageSkeleton,
  PageTabsSkeleton,
  SkeletonText,
  TabbedSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from '@/components/layout/page-skeleton';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';

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

// The group's name is the h1, which only the loaded group knows.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="groups" self />}
      title={<SkeletonText text="Ôn thi N2" />}
      meta
      actions={
        <>
          <Skeleton className="h-9 w-28 rounded-sm md:h-7" />
          <Skeleton className="h-9 w-16 rounded-sm md:h-7" />
          <Skeleton className="h-9 w-20 rounded-sm md:h-7" />
        </>
      }
      actionsOnPhone="split"
      tabs={<PageTabsSkeleton set="group" />}
    >
      <TabbedSkeleton
        storeKey="group.tab"
        initial="list"
        shapes={{
          list: (
            <>
              <ToolbarSkeleton columnMenu />
              <TableSkeleton />
            </>
          ),
          flashcard: FLASHCARD,
        }}
      />
    </PageSkeleton>
  );
}

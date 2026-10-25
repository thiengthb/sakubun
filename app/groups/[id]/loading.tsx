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

// GroupCards' shape: progress, the card filling the screen, the controls, the one-line note.
const FLASHCARD = (
  <div className="mx-auto flex min-h-[calc(100dvh-16rem)] w-full max-w-3xl flex-col gap-4">
    <Skeleton className="h-1.5 w-full rounded-full" />
    <Skeleton className="min-h-72 flex-1 rounded-xl" />
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-9 w-20 rounded-md md:h-7" />
      <Skeleton className="h-9 w-36 rounded-md md:h-7" />
      <Skeleton className="h-9 w-20 rounded-md md:h-7" />
    </div>
    <Skeleton className="mx-auto h-3 w-72 max-w-full" />
  </div>
);

// The group's name is the h1, which only the loaded group knows.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="groups" self />}
      title={<SkeletonText text="Ôn thi N2" />}
      meta={
        // The kind chip, then the size: GroupDetailView's meta line.
        <div className="flex h-5 items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-sm" />
          <Skeleton className="h-3 w-12" />
        </div>
      }
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

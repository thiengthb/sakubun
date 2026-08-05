import {
  ListSkeleton,
  PageSkeleton,
  TabbedSkeleton,
  TabsAside,
  ToolbarSkeleton,
} from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Group detail — 2 tabs (Danh sách / Flashcard). Rail 178px at 1440, select 126px at 390 (measured).
//
// The two tabs have NOTHING in common structurally: one is a toolbar over a paged member list, the other
// is a single card that fills the viewport. The tab is session state (`group.tab`, no URL mirror), so the
// skeleton reads it the same way the page does instead of always guessing "list".
const LIST = (
  <div className="space-y-6">
    {/* search + copy-command + edit + add: three icon-sized controls after the search box. */}
    <ToolbarSkeleton action filters={2} />
    {/* Real member rows are h-16 in ONE ring-bordered card, and the list is viewport-fitted. */}
    <ListSkeleton auto rows={6} rowHeight={64} />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-64" />
    </div>
  </div>
);

// Flashcards: the same frame the real deck uses — `min-h-[calc(100svh-6rem)]`, so the card placeholder
// fills what is left after the counter row, the progress bar, the hint line and the grading buttons.
const FLASHCARD = (
  <div className="flex min-h-[calc(100svh-6rem)] w-full flex-col gap-3">
    <div className="flex items-center justify-between gap-2">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="size-8 rounded-md" />
    </div>
    <Skeleton className="h-3 w-full rounded-full" />
    <Skeleton className="min-h-[15rem] w-full flex-1 rounded-2xl" />
    <Skeleton className="mx-auto h-4 w-72" />
    <div className="mx-auto flex w-full max-w-xl items-center gap-3">
      <Skeleton className="h-10 flex-1 rounded-md" />
      <Skeleton className="h-10 flex-1 rounded-md" />
    </div>
    <Skeleton className="mx-auto h-8 w-44 rounded-md" />
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

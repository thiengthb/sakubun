import {
  CardGridSkeleton,
  PageSkeleton,
  ToolbarSkeleton,
} from '@/components/shell/page-skeleton';

// History — NO tabs. It was a two-tab shell ("Của tôi" / "Cộng đồng") until the community feed went out
// with the rest of the multi-user surface; the skeleton kept drawing a 2-tab rail on the header row of a
// page that has none (fixed 2026-08-05). Body: the list toolbar (search + view/filter buttons) over a
// card grid — real cards are ~120px, one column below lg then two — and CardGridSkeleton renders the
// paged footer itself. Three toolbar buttons since 2026-08-06: list/flashcard, column density, filters.
export default function Loading() {
  return (
    <PageSkeleton section="history">
      <ToolbarSkeleton filters={3} />
      <CardGridSkeleton rowHeight={120} columns="grid-cols-1 lg:grid-cols-2" />
    </PageSkeleton>
  );
}

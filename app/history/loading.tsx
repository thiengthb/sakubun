import {
  CardGridSkeleton,
  PageSkeleton,
  TabsAside,
  ToolbarSkeleton,
} from '@/components/shell/page-skeleton';

// History — 2 tabs (Của tôi / Cộng đồng); toolbar (search + grid toggle + filter) over a card grid
// (real cards are 120px, 1 col below lg then 2). CardGridSkeleton renders the paged footer itself.
export default function Loading() {
  return (
    <PageSkeleton aside={<TabsAside count={2} />}>
      <ToolbarSkeleton />
      <CardGridSkeleton rowHeight={120} columns="grid-cols-1 lg:grid-cols-2" />
    </PageSkeleton>
  );
}

import {
  PageSkeleton,
  TableSkeleton,
  TabsAside,
  ToolbarSkeleton,
} from '@/components/shell/page-skeleton';

// Library — 2 tabs (Ngữ pháp / Từ vựng); toolbar (search + filter, no create) over a shared table.
export default function Loading() {
  return (
    <PageSkeleton aside={<TabsAside count={2} />}>
      <ToolbarSkeleton />
      <TableSkeleton />
    </PageSkeleton>
  );
}

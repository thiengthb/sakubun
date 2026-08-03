import {
  PageSkeleton,
  TableSkeleton,
  TabsAside,
  ToolbarSkeleton,
} from '@/components/shell/page-skeleton';

// Resources — 3 tabs (Ngữ pháp / Từ vựng / Nhóm); toolbar (search + filter + create) over a table.
export default function Loading() {
  return (
    <PageSkeleton aside={<TabsAside count={3} />}>
      <ToolbarSkeleton action />
      <TableSkeleton />
    </PageSkeleton>
  );
}

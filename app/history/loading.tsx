import { PageSkeleton, TableSkeleton, ToolbarSkeleton } from '@/components/layout/page-skeleton';

// The count is the only thing in the header that waits for data.
export default function Loading() {
  return (
    <PageSkeleton template="list" title="Lịch sử" meta>
      <ToolbarSkeleton filters={1} columnMenu />
      <TableSkeleton cardHeight={108} />
    </PageSkeleton>
  );
}

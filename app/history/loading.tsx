import { CardsSkeleton, PageSkeleton, ToolbarSkeleton } from '@/components/layout/page-skeleton';

// Cards on every width, paged from 1024px, like the page. The count is the only thing in the header
// that waits for data.
export default function Loading() {
  return (
    <PageSkeleton template="list" title="Lịch sử" meta>
      <ToolbarSkeleton filters={1} />
      <CardsSkeleton rowHeight={112} max={12} footer="lg" />
    </PageSkeleton>
  );
}

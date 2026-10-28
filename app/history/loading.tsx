import { PageSkeleton, TimelineSkeleton, ToolbarSkeleton } from '@/components/layout/page-skeleton';

// The timeline of days at every width, like the page; it loads more as it scrolls, so no footer.
// The count is the only thing in the header that waits for data.
export default function Loading() {
  return (
    <PageSkeleton template="list" title="Lịch sử" meta>
      <ToolbarSkeleton filters={1} />
      <TimelineSkeleton />
    </PageSkeleton>
  );
}

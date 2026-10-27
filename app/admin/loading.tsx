import { CardsSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';

// Cards on every width, like the page; the count is the only thing in the header that waits.
export default function Loading() {
  return (
    <PageSkeleton template="list" title="Quản trị" meta>
      <CardsSkeleton rowHeight={96} footer={false} />
    </PageSkeleton>
  );
}

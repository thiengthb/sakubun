import {
  CardGridSkeleton,
  PageSkeleton,
  ToolbarSkeleton,
} from '@/components/shell/page-skeleton';

export default function Loading() {
  return (
    <PageSkeleton section="history">
      <ToolbarSkeleton filters={3} />
      <CardGridSkeleton rowHeight={120} columns="grid-cols-1 lg:grid-cols-2" />
    </PageSkeleton>
  );
}

import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// The canvas opened in its editor (7.4f): the title field and the text on the left, the preview on
// the right; a phone shows the Viết and Xem trước switch above the text.
export default function Loading() {
  return (
    <PageSkeleton
      template="list"
      trail={<ParentCrumbs section="kaiwa" self />}
      title="Thêm kịch bản"
      actions={
        <>
          <Skeleton className="h-8.5 w-32 rounded-sm md:h-6.5" />
          <Skeleton className="size-9 rounded-sm md:size-7" />
        </>
      }
      actionsOnPhone="split"
    >
      <div className="space-y-4">
        <Skeleton className="h-9 w-40 rounded-sm md:hidden" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-9 w-full rounded-sm md:h-7" />
            <Skeleton className="h-96 md:h-120 w-full rounded-lg" />
          </div>
          <div className="space-y-2 max-md:hidden">
            <Skeleton className="h-16 w-2/3 rounded-2xl" />
            <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
          </div>
        </div>
      </div>
    </PageSkeleton>
  );
}

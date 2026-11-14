import { PageSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Hôm nay (U3b), as the page lays it out: the lead area and Việc tiếp theo on the left; on a laptop
// the week, Cần xử lý and the next 14 days on the right.
export default function Loading() {
  return (
    <PageSkeleton template="dashboard" title="Hôm nay" meta width="wide">
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Skeleton className="h-48 rounded-xl md:h-52" />
          <Skeleton className="h-52 rounded-xl" />
        </div>
        <div className="space-y-4 max-lg:hidden lg:col-span-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
      </div>
    </PageSkeleton>
  );
}

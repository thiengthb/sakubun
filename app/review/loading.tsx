import { PageSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <PageSkeleton section="review" width="form">
      <div className="flex items-center gap-2">
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="space-y-4 pt-1">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-24 w-full" />
      </div>
    </PageSkeleton>
  );
}

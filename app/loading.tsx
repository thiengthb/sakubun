import { PageSkeleton, PageTabsSkeleton } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Tiến độ, top to bottom: four stat tiles, today's rings, Nhớ đúng + 14 ngày tới, Theo cấp +
// Điểm yếu, the year heatmap.
export default function Loading() {
  return (
    <PageSkeleton
      template="dashboard"
      title="Phân tích"
      tabs={<PageTabsSkeleton set="analytics" />}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-lg" />
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </div>
    </PageSkeleton>
  );
}

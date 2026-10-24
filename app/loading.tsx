import { PageSkeleton, TabsAside } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Tiến độ, top to bottom: four stat tiles, today's rings, Nhớ đúng + 14 ngày tới, Theo cấp +
// Điểm yếu, the year heatmap.
export default function Loading() {
  return (
    <PageSkeleton section="dashboard" aside={<TabsAside count={2} rail={152} select={103} />}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-18 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-xl" />
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl lg:col-span-2" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </PageSkeleton>
  );
}

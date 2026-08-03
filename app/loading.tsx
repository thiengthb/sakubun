import { PageSkeleton, TabsAside } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// "/" serves exactly ONE page now — the dashboard (a guest is redirected to /login, never rendered
// here), so the fallback no longer has to resolve auth to pick a shape.
export default function Loading() {
  // Dashboard "/" — 2 tabs (Tiến độ / Thống kê); body is a stat-card row + full-width charts.
  return (
    <PageSkeleton aside={<TabsAside count={2} />}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-56 rounded-lg" />
      </div>
    </PageSkeleton>
  );
}

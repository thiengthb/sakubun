import { PageSkeleton, TabsAside } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// "/" serves exactly ONE page now — the dashboard (a guest is redirected to /login, never rendered
// here), so the fallback no longer has to resolve auth to pick a shape.
//
// It is ALSO the fallback for any route without its own loading.tsx. Every route that renders a
// PageShell now has one (lib/skeleton-parity.test.ts is the gate), so in practice this is the
// dashboard's own — but that gate is why the shape here may stay dashboard-specific.
//
// Aside: 2 tabs (Tiến độ / Thống kê). Rail 152px at 1440, select 103px at 390 — both measured.
// Body: DailyProgress card, the year heatmap, the 14-day forecast, then a 2-up chart row, spaced
// `space-y-6` by the TabsContent (PageShell's own rhythm is space-y-4, so the body carries its own).
export default function Loading() {
  return (
    <PageSkeleton section="dashboard" aside={<TabsAside count={2} rail={152} select={103} />}>
      <div className="space-y-6">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      </div>
    </PageSkeleton>
  );
}

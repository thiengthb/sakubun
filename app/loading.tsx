import { PageSkeleton, TabsAside } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { LandingSkeleton } from '@/components/landing/landing-skeleton';
import { getOptionalSessionUser } from '@/lib/current-user';

// "/" serves TWO different pages by auth (see app/page.tsx): the public LANDING for guests, the
// dashboard for signed-in users. The fallback must match, or a guest reloading "/" flashes the
// dashboard skeleton (sidebar-shell shaped) before the marketing page appears. Resolve auth here — the
// same cheap session read the layout already does — and stand in for the page the visitor will get.
export default async function Loading() {
  const authed = (await getOptionalSessionUser()) !== null;
  if (!authed) return <LandingSkeleton />;

  // Signed-in dashboard "/" — 2 tabs (Tiến độ / Thống kê); body is a stat-card row + full-width charts.
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

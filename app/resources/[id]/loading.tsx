import { PageSkeleton } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Resource item detail — no headerAside tabs; an item header + two content sub-tabs, then a stat-card
// grid and a chart card (the "Chỉ số & lịch" default view).
export default function Loading() {
  return (
    <PageSkeleton>
      {/* Item header: term + a couple of badges. */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      {/* Content sub-tabs row + a right-aligned copy-command action. */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-8 w-28 rounded-md" />
        <Skeleton className="ml-auto h-8 w-40 rounded-md" />
      </div>
      {/* Stat cards (8) then the forgetting-curve chart card. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </PageSkeleton>
  );
}

import { PageSkeleton } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Account — no tabs; profile card (identity + timeline + edit forms) then a 3-up token grid.
export default function Loading() {
  return (
    <PageSkeleton>
      {/* Profile card. */}
      <div className="space-y-6 rounded-xl border p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-6 border-t pt-6 md:grid-cols-2">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-44 rounded-lg" />
        </div>
      </div>

      {/* Token card. */}
      <div className="space-y-6 rounded-xl border p-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    </PageSkeleton>
  );
}

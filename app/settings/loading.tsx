import { PageSkeleton, TabsAside } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// The Luyện tập tab is one card of rows (components/features/settings/setting-row.tsx): icon tile,
// short name, control on the right. Nine rows: eight settings and the collapsed Nâng cao.
const CONTROL_WIDTHS = [220, 104, 104, 104, 260, 32, 280, 220, 16];

export default function Loading() {
  return (
    <PageSkeleton
      section="settings"
      aside={
        <>
          <TabsAside count={3} rail={233} select={119} />
          <Skeleton className="ml-auto size-8 shrink-0 rounded-md" />
        </>
      }
    >
      <div className="max-w-3xl divide-y overflow-hidden rounded-xl ring-1 ring-foreground/10">
        {CONTROL_WIDTHS.map((width, i) => (
          <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
            <Skeleton className="size-8 shrink-0 rounded-lg" />
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="ml-auto h-8 min-w-0 rounded-lg" style={{ width }} />
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}

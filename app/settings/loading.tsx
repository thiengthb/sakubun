import {
  FormFooterSkeleton,
  PageSkeleton,
  PageTabsSkeleton,
} from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// The Luyện tập tab is one card of rows (components/features/settings/setting-row.tsx): icon tile,
// short name, control on the right; two columns once the card is wide. Eight settings, then the
// collapsed Nâng cao row across both columns.
const CONTROL_WIDTHS = [220, 104, 104, 104, 260, 32, 280, 220];

export default function Loading() {
  return (
    <PageSkeleton
      template="form"
      title="Cài đặt"
      tabs={<PageTabsSkeleton count={3} widths={[88, 72, 88]} />}
    >
      <div className="@container overflow-hidden rounded-xl ring-2 ring-border ring-inset">
        <div className="grid gap-px bg-border @4xl:grid-cols-2 [&>*]:bg-card">
          {CONTROL_WIDTHS.map((width, i) => (
            <div key={i} className="flex min-h-14 items-center gap-3 px-4 py-2.5">
              <Skeleton className="size-8 shrink-0 rounded-sm" />
              <Skeleton className="h-4 w-20 shrink-0" />
              <Skeleton className="ml-auto h-9 min-w-0 rounded-sm md:h-7" style={{ width }} />
            </div>
          ))}
          <div className="col-span-full flex min-h-14 items-center gap-3 px-4 py-2.5">
            <Skeleton className="size-8 shrink-0 rounded-sm" />
            <Skeleton className="h-4 w-20 shrink-0" />
            <Skeleton className="ml-auto size-4 rounded-sm" />
          </div>
        </div>
      </div>
      <FormFooterSkeleton />
    </PageSkeleton>
  );
}

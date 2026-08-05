import { PageSkeleton, TabsAside } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Settings — FIVE tabs (Nội dung / Nhịp học / Nghe & nói / Dữ liệu / Tài khoản), not the four this file
// claimed until 2026-08-05, plus the Save action pinned right. Rail 396px at 1440, select 114px at 390.
//
// The five-pill rail is exactly what made this the worst skeleton in the app on a phone: drawn at EVERY
// width, it overflowed a 390px viewport by 134px and wrapped the header row onto two lines. Below md the
// real control is one select, which is what TabsAside now draws there.
//
// Body: every tab is a card stack (`SettingsTab`), so one card shape covers all five.
export default function Loading() {
  return (
    <PageSkeleton
      section="settings"
      aside={
        <>
          <TabsAside count={5} rail={396} select={114} />
          <Skeleton className="ml-auto size-8 shrink-0 rounded-md" />
        </>
      }
    >
      <div className="space-y-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </PageSkeleton>
  );
}

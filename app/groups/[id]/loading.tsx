import {
  FitList,
  PageSkeleton,
  TabsAside,
  ToolbarSkeleton,
} from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Group detail — 2 tabs (Danh sách / Flashcard); toolbar (search + copy-command + edit/add actions)
// over a viewport-fitted divide-y member list (real rows are `h-16` = 64px: two text lines + a detail
// icon, no avatar), then pagination. The list fills the screen like the real member list (rowHeight 64).
export default function Loading() {
  return (
    <PageSkeleton aside={<TabsAside count={2} />}>
      <ToolbarSkeleton action />
      <FitList
        rowHeight={64}
        fallback={6}
        className="divide-y rounded-lg border"
        item={
          <div className="flex h-16 items-center gap-2 px-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="size-8 shrink-0 rounded-md" />
          </div>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-64" />
      </div>
    </PageSkeleton>
  );
}

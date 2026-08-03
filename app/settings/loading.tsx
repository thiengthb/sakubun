import { PageSkeleton, TabsAside } from '@/components/shell/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// Settings — 4 tabs (Nội dung / Nhịp học / Nghe & nói / Dữ liệu) + a Save action; body is a form.
export default function Loading() {
  return (
    <PageSkeleton
      aside={
        <div className="ml-auto flex items-center gap-2">
          <TabsAside count={4} />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      }
    >
      <Skeleton className="h-48 rounded-lg" />
      <Skeleton className="h-48 rounded-lg" />
    </PageSkeleton>
  );
}

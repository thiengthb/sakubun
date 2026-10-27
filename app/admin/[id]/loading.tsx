import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { Skeleton } from '@/components/ui/skeleton';

// The account page, top to bottom: four stat tiles, Nhớ đúng + Theo cấp, the year heatmap.
export default function Loading() {
  return (
    <PageSkeleton
      template="detail"
      trail={<ParentCrumbs section="admin" self />}
      title={<SkeletonText text="Nguyễn Văn An" />}
      subtitle={
        <div className="flex h-6 items-center">
          <Skeleton className="h-4 w-44" />
        </div>
      }
      facts={[
        { label: 'Trạng thái', value: 'Người học' },
        { label: 'Tạo', value: '27/10/2026' },
        { label: 'Ôn gần nhất', value: '1 giờ trước' },
        { label: 'Đăng nhập', value: '1 giờ trước' },
      ]}
      pageIcons={<Skeleton className="size-9 rounded-md md:size-7" />}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-44 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
        <Skeleton className="h-40 rounded-lg" />
      </div>
    </PageSkeleton>
  );
}

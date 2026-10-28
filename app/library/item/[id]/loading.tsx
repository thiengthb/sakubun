import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

// LibraryItemView's shape: the detail header (the entry's name waits on data), then its formation,
// its example sentence and the groups it is in.
export default function Loading() {
  return (
    <PageSkeleton
      template="detail"
      trail={<ParentCrumbs section="library" self />}
      title={<SkeletonText text="〜ばかりに" />}
      facts={[
        { label: 'Cấp độ', value: 'N5' },
        { label: 'Loại', value: 'Ngữ pháp' },
        { label: 'Nguồn', value: 'OpenJLPT' },
        { label: 'Lượt lấy', value: '0' },
      ]}
      subtitle={
        <div className="flex h-6 items-center">
          <Skeleton className="h-4 w-44" />
        </div>
      }
      actions={<Skeleton className="h-9 w-28 rounded-sm md:h-7" />}
      pageIcons={<Skeleton className="h-9 w-14 rounded-sm md:h-7" />}
    >
      <div className="space-y-6 md:space-y-8">
        {[64, 40].map((heading) => (
          <section key={heading} className="space-y-3">
            <div className="flex h-5 items-center">
              <Skeleton className="h-3.5" style={{ width: heading }} />
            </div>
            <Skeleton className="h-12 rounded-sm" />
          </section>
        ))}
      </div>
    </PageSkeleton>
  );
}

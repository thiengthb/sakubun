import { FormCardSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';

export default function Loading() {
  return (
    <PageSkeleton
      template="form"
      trail={<ParentCrumbs section="kaiwa" self />}
      title="Thêm kịch bản"
    >
      <FormCardSkeleton layout={[{ count: true }, { area: true, count: true }]} />
    </PageSkeleton>
  );
}

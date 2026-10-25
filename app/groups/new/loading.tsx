import { FormCardSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';

export default function Loading() {
  return (
    <PageSkeleton template="form" trail={<ParentCrumbs section="groups" self />} title="Thêm nhóm">
      <FormCardSkeleton fields={3} />
    </PageSkeleton>
  );
}

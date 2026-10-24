import { FormCardSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';

export default function Loading() {
  return (
    <PageSkeleton template="form" trail title="Sửa nhóm" meta>
      <FormCardSkeleton fields={3} />
    </PageSkeleton>
  );
}

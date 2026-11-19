import { FormCardSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';
import { KhoTrail } from '@/components/layout/kho-trail';

export default function Loading() {
  return (
    <PageSkeleton template="form" trail={<KhoTrail place={{ way: 'groups' }} />} title="Sửa nhóm">
      <FormCardSkeleton fields={3} />
    </PageSkeleton>
  );
}

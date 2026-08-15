import { FormCardSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';

export default function Loading() {
  return (
    <PageSkeleton width="form" section="grammar" action="edit">
      <FormCardSkeleton intro fields={6} />
    </PageSkeleton>
  );
}

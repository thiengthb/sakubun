import { FormCardSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';

export default function Loading() {
  return (
    <PageSkeleton template="form" trail meta>
      <FormCardSkeleton fields={5} />
    </PageSkeleton>
  );
}

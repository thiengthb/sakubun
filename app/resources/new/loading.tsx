import { FormCardSkeleton, PageSkeleton, PageTabsSkeleton } from '@/components/layout/page-skeleton';

export default function Loading() {
  return (
    <PageSkeleton
      template="form"
      trail
      tabs={<PageTabsSkeleton count={3} widths={[104, 120, 96]} />}
    >
      <FormCardSkeleton fields={5} />
    </PageSkeleton>
  );
}

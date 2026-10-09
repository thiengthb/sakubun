import { FormCardSkeleton, PageSkeleton } from '@/components/shell/page-skeleton';

export default function Loading() {
  return (
    <PageSkeleton width="form" section="groups" action="add">
      <FormCardSkeleton intro fields={3} />
    </PageSkeleton>
  );
}

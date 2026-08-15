import { FormCardSkeleton, PageSkeleton, TabsAside } from '@/components/layout/page-skeleton';

export default function Loading() {
  return (
    <PageSkeleton width="form" section="grammar" action="add" aside={<TabsAside count={3} rail={317} select={137} />}>
      <FormCardSkeleton fields={5} />
    </PageSkeleton>
  );
}

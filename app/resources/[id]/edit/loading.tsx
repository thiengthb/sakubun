import { FormCardSkeleton, PageSkeleton, SkeletonText } from '@/components/layout/page-skeleton';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';

// The page names the item's kind ("Sửa ngữ pháp"), which only the loaded item knows.
export default function Loading() {
  return (
    <PageSkeleton
      template="form"
      trail={<ParentCrumbs section="grammar" self pending />}
      title={
        <>
          Sửa <SkeletonText text="ngữ pháp" />
        </>
      }
    >
      <FormCardSkeleton fields={5} />
    </PageSkeleton>
  );
}

import {
  FormFooterSkeleton,
  PageSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from '@/components/layout/page-skeleton';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';

// The trail ends in the group's name, which only the loaded group knows.
export default function Loading() {
  return (
    <PageSkeleton
      template="form"
      trail={<ParentCrumbs section="groups" self record={{ label: 'Ôn thi N2', pending: true }} />}
      title="Thêm mục"
      meta
    >
      <ToolbarSkeleton columnMenu />
      <TableSkeleton />
      <FormFooterSkeleton />
    </PageSkeleton>
  );
}

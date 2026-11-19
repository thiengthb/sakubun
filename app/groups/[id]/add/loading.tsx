import {
  FormFooterSkeleton,
  PageSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
} from '@/components/layout/page-skeleton';
import { KhoTrail } from '@/components/layout/kho-trail';

// The trail ends in the group's name, which only the loaded group knows.
export default function Loading() {
  return (
    <PageSkeleton
      template="form"
      trail={
        <KhoTrail
          place={{ way: 'groups' }}
          extra={[{ label: 'Ôn thi N2', href: '', pending: true }]}
        />
      }
      title="Thêm mục"
      meta
    >
      <ToolbarSkeleton columnMenu />
      <TableSkeleton />
      <FormFooterSkeleton />
    </PageSkeleton>
  );
}

import { FormCardSkeleton, PageSkeleton } from '@/components/shell/page-skeleton';

// /groups/<id>/edit — same form as /groups/new, on an existing group. `width="form"`, no header aside.
// NEW 2026-08-05.
export default function Loading() {
  return (
    <PageSkeleton width="form" section="groups" action="edit">
      <FormCardSkeleton intro fields={3} />
    </PageSkeleton>
  );
}

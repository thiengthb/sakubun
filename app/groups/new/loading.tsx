import { FormCardSkeleton, PageSkeleton } from '@/components/shell/page-skeleton';

// /groups/new — the create-group form (the phone path; desktop opens the dialog instead).
// `width="form"`, no header aside. NEW 2026-08-05.
export default function Loading() {
  return (
    <PageSkeleton width="form" section="groups" action="add">
      <FormCardSkeleton intro fields={3} />
    </PageSkeleton>
  );
}

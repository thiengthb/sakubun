import { FormCardSkeleton, PageSkeleton } from '@/components/shell/page-skeleton';

// /resources/<id>/edit — `width="form"`, no header aside (its one select lives inside the form), a
// description line, then the edit card. NEW 2026-08-05: it fell back to the dashboard skeleton, which
// meant a full-bleed 4-card grid flashing before a 672px form.
export default function Loading() {
  return (
    <PageSkeleton width="form" section="grammar" action="edit">
      <FormCardSkeleton intro fields={6} />
    </PageSkeleton>
  );
}

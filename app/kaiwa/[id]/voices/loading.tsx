import { FormCardSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';
import { VOICES_NOTE } from '@/components/features/kaiwa/kaiwa-voices-form';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';

// Giọng từng vai: the script's name in the trail, then a row per part (a select and its first line).
export default function Loading() {
  return (
    <PageSkeleton
      template="form"
      trail={<ParentCrumbs section="kaiwa" self record={{ label: 'Ở nhà hàng', pending: true }} />}
      title="Giọng từng vai"
      meta={<span>{VOICES_NOTE}</span>}
    >
      <FormCardSkeleton fields={2} />
    </PageSkeleton>
  );
}

'use client';

import { useSearchParams } from 'next/navigation';
import { FormCardSkeleton, PageSkeleton } from '@/components/layout/page-skeleton';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { ITEM_FIELDS } from '@/components/features/resources/item-fields-skeleton';
import { ItemGuide } from '@/components/features/resources/item-guide';

// thien, 2026-10-25: the loading screen names what is being edited, as the page will. Only the
// loaded item knows its kind, so every link to this page carries it (?kind=); a bare URL says "mục".
export default function Loading() {
  const param = useSearchParams().get('kind');
  const kind = param === 'grammar' || param === 'vocab' ? param : null;
  return (
    <PageSkeleton
      template="form"
      trail={<ParentCrumbs section={kind ?? 'grammar'} self pending={!kind} />}
      title={kind === 'grammar' ? 'Sửa ngữ pháp' : kind === 'vocab' ? 'Sửa từ vựng' : 'Sửa mục'}
    >
      <FormCardSkeleton layout={ITEM_FIELDS} />
      <ItemGuide kind={kind ?? 'grammar'} editing />
    </PageSkeleton>
  );
}

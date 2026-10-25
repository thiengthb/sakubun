'use client';

import { useSearchParams } from 'next/navigation';
import {
  FormCardSkeleton,
  PageSkeleton,
  PageTabsSkeleton,
} from '@/components/layout/page-skeleton';
import { ParentCrumbs } from '@/components/layout/app-breadcrumbs';
import { ITEM_FIELDS } from '@/components/features/resources/item-fields-skeleton';
import { ItemGuide } from '@/components/features/resources/item-guide';

// The kind is in the URL, so the loading screen names it as the page will.
export default function Loading() {
  const kind = useSearchParams().get('kind') === 'vocab' ? 'vocab' : 'grammar';
  return (
    <PageSkeleton
      template="form"
      trail={<ParentCrumbs section={kind} self />}
      title={kind === 'grammar' ? 'Thêm ngữ pháp' : 'Thêm từ vựng'}
      tabs={<PageTabsSkeleton set="input" />}
    >
      <FormCardSkeleton layout={ITEM_FIELDS} />
      <ItemGuide kind={kind} />
    </PageSkeleton>
  );
}

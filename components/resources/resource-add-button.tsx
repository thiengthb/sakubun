import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ExpandingIconButton } from '@/components/shared/expanding-icon-button';
import type { ResourceKind } from '@/components/resources/resource-add-form';

const LABEL: Record<ResourceKind, string> = {
  grammar: 'Thêm ngữ pháp',
  vocab: 'Thêm từ vựng',
};

/**
 * The toolbar button that opens the add form. It used to be a `DialogTrigger`; it is now a LINK to
 * `/resources/new` (see ResourceAddForm for why the modal became a route). Same button component, so it
 * still lines up with the other toolbar actions and is icon-only below md.
 *
 * `asChild` puts the Link inside, so the whole control is one navigation target and Next prefetches it.
 */
export function ResourceAddButton({ kind }: { kind: ResourceKind }) {
  return (
    <ExpandingIconButton asChild icon={Plus} label={LABEL[kind]} variant="default">
      <Link href={`/resources/new?kind=${kind}`} />
    </ExpandingIconButton>
  );
}

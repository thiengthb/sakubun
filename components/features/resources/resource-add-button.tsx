import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
import type { ResourceKind } from '@/components/features/resources/resource-add-form';

/** A list page's create action: plus, the word "Thêm", and a page of its own (no dialog). */
export function AddButton({ href }: { href: string }) {
  return (
    <ExpandingIconButton asChild icon={Plus} label="Thêm" variant="default" labelOnPhone>
      <Link href={href} />
    </ExpandingIconButton>
  );
}

export function ResourceAddButton({ kind }: { kind: ResourceKind }) {
  return <AddButton href={`/resources/new?kind=${kind}`} />;
}

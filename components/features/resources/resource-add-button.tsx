import { AddButton } from '@/components/common/add-button';
import type { ResourceKind } from '@/components/features/resources/resource-add-form';

export function ResourceAddButton({ kind }: { kind: ResourceKind }) {
  return <AddButton href={`/resources/new?kind=${kind}`} />;
}

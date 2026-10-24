import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/core/utils';
import { GROUP_KIND_LABELS, type GroupKind } from '@/lib/library/group-kinds';

// The same chip as an item's level and state on its detail page: Badge's outline, in the kind's colour.
const KIND_CLASS: Record<GroupKind, string> = {
  vocab: 'border-info/60 text-info',
  grammar: 'border-ok/60 text-ok',
  mixed: 'text-muted-foreground',
};

export function GroupKindBadge({ kind, className }: { kind: GroupKind; className?: string }) {
  return (
    <Badge variant="outline" className={cn(KIND_CLASS[kind], className)}>
      {GROUP_KIND_LABELS[kind]}
    </Badge>
  );
}

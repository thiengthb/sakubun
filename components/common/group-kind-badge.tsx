import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/core/utils';
import { GROUP_KIND_LABELS, type GroupKind } from '@/lib/library/group-kinds';

// The same chip as an item's level and state on its detail page: Badge's outline, in the kind's colour.
// Kind colours are their own tokens (--kind-*), never the ok/info status colours a grade uses.
const KIND_CLASS: Record<GroupKind, string> = {
  vocab: 'border-kind-vocab/60 text-kind-vocab',
  grammar: 'border-kind-grammar/60 text-kind-grammar',
  mixed: 'text-muted-foreground',
};

export function GroupKindBadge({ kind, className }: { kind: GroupKind; className?: string }) {
  return (
    <Badge variant="outline" className={cn(KIND_CLASS[kind], className)}>
      {GROUP_KIND_LABELS[kind]}
    </Badge>
  );
}

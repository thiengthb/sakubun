import { cn } from '@/lib/utils';
import type { GroupKind } from '@/lib/group-kinds';

export const GROUP_KIND_LABELS: Record<GroupKind, string> = {
  vocab: 'Từ vựng',
  grammar: 'Ngữ pháp',
  mixed: 'Hỗn hợp',
};

const KIND_CLASS: Record<GroupKind, string> = {
  vocab: 'border-info/30 bg-info/10 text-info',
  grammar: 'border-ok/30 bg-ok/10 text-ok',
  mixed: 'border-border bg-muted text-muted-foreground',
};

export function GroupKindBadge({ kind, className }: { kind: GroupKind; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        KIND_CLASS[kind],
        className,
      )}
    >
      {GROUP_KIND_LABELS[kind]}
    </span>
  );
}

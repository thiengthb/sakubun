'use client';

import Link from 'next/link';
import { Layers, Pencil, Trash2 } from 'lucide-react';
import { CardAction } from '@/components/common/card-action';
import { GroupKindBadge } from '@/components/common/group-kind-badge';
import { LIST_CARD } from '@/components/common/list-card';
import { Truncate } from '@/components/ui/truncate';
import { cn } from '@/lib/core/utils';
import type { GroupSummary } from '@/lib/library/groups';

// One of the learner's groups on Tài nguyên › Nhóm (thien, 7.4): the name and the note one line
// each, in full in a tooltip when cut; edit and delete as icons.
export function GroupCard({
  group,
  onDelete,
}: {
  group: GroupSummary;
  onDelete: (group: GroupSummary) => void;
}) {
  return (
    <li className={cn(LIST_CARD.base, LIST_CARD.linked, 'flex min-w-0 flex-col gap-1')}>
      <Link href={`/groups/${group.id}`} className={LIST_CARD.link}>
        <span className="sr-only">Mở nhóm {group.name}</span>
      </Link>

      <div className="flex items-center gap-2">
        <Layers className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Truncate className="flex-1 font-medium">{group.name}</Truncate>
        <span className="flex shrink-0 items-center gap-0.5">
          <CardAction icon={Pencil} label="Sửa nhóm" href={`/groups/${group.id}/edit`} />
          <CardAction
            icon={Trash2}
            label="Xoá nhóm"
            onClick={() => onDelete(group)}
            className="hover:text-destructive"
          />
        </span>
      </div>

      <Truncate
        className={cn('text-sm text-muted-foreground', !group.note && 'text-muted-foreground/70')}
      >
        {group.note || 'Chưa có ghi chú'}
      </Truncate>

      <div className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
        <span>{group.memberCount} mục</span>
        <span aria-hidden>·</span>
        <GroupKindBadge kind={group.kind} />
      </div>
    </li>
  );
}

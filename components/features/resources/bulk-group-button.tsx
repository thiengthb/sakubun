'use client';

import { useTransition } from 'react';
import { FolderMinus, FolderPlus } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { BulkActionButton } from '@/components/features/resources/bulk-action-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import { addItemsToGroupAction, removeItemsFromGroupAction } from '@/app/actions';
import type { GroupSummary } from '@/lib/library/groups';

function BulkGroupButton({
  mode,
  groups,
  ids,
  onDone,
}: {
  mode: 'add' | 'remove';
  groups: GroupSummary[];
  ids: string[];
  onDone?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  if (groups.length === 0) return null;

  const run = (groupId: string) =>
    startTransition(async () => {
      if (mode === 'add') {
        const r = await addItemsToGroupAction(groupId, ids);
        if (toastResult(r, (d) => `Đã thêm ${d.added} mục vào nhóm`)) onDone?.();
      } else {
        const r = await removeItemsFromGroupAction(groupId, ids);
        if (toastResult(r, (d) => `Đã gỡ ${d.removed} mục khỏi nhóm`)) onDone?.();
      }
    });

  const Icon = mode === 'add' ? FolderPlus : FolderMinus;
  const label = mode === 'add' ? 'Thêm vào nhóm' : 'Gỡ khỏi nhóm';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <BulkActionButton icon={Icon} label={label} pending={isPending} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="left" align="start" className="max-w-72 min-w-56">
        {groups.map((g) => (
          <DropdownMenuItem key={g.id} onSelect={() => run(g.id)}>
            <span className="min-w-0 truncate">{g.name}</span>
            <span className="ml-auto pl-3 text-xs whitespace-nowrap text-muted-foreground">
              {GROUP_KIND_LABELS[g.kind]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BulkGroupActions({
  groups,
  kind,
  rows,
  onDone,
}: {
  groups: GroupSummary[];
  kind: 'grammar' | 'vocab';
  rows: { itemId: string; groupIds?: string[] }[];
  onDone?: () => void;
}) {
  const ids = rows.map((r) => r.itemId);
  const accepts = groups.filter((g) => g.kind === 'mixed' || g.kind === kind);
  const selected = new Set(rows.flatMap((r) => r.groupIds ?? []));

  return (
    <>
      <BulkGroupButton mode="add" groups={accepts} ids={ids} onDone={onDone} />
      <BulkGroupButton
        mode="remove"
        groups={groups.filter((g) => selected.has(g.id))}
        ids={ids}
        onDone={onDone}
      />
    </>
  );
}

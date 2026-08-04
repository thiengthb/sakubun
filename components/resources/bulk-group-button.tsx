'use client';

import { useTransition } from 'react';
import { FolderMinus, FolderPlus } from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { BulkActionButton } from '@/components/resources/bulk-action-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GROUP_KIND_LABELS } from '@/components/groups/group-kind-badge';
import { addItemsToGroupAction, removeItemsFromGroupAction } from '@/app/actions';
import type { GroupSummary } from '@/lib/groups';

/**
 * Bulk "add to / remove from group" for the resources DataTable selection dock. `groups` is already
 * narrowed by the caller: for ADD, only groups whose kind accepts this table's items; for REMOVE, only
 * groups the selection actually belongs to. Renders nothing when there's no eligible target. A picked
 * group runs the matching action over the selected ids, then clears the selection on success.
 */
export function BulkGroupButton({
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
      {/* The dock is pinned to the right edge, so the group list opens to its LEFT (never off-screen). */}
      <DropdownMenuContent side="left" align="start">
        {groups.map((g) => (
          <DropdownMenuItem key={g.id} onSelect={() => run(g.id)}>
            <span className="min-w-0 truncate">{g.name}</span>
            <span className="ml-auto pl-3 text-xs text-muted-foreground">
              {GROUP_KIND_LABELS[g.kind]}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

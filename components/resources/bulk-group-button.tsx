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
      {/* min-w so a group name is not truncated to "Ngữ ph..." the moment the dock is narrow, max-w so
          a long one still wraps instead of stretching the menu off-screen. */}
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

/**
 * Both group buttons for a resources table's selection dock, with the narrowing done once.
 *
 * ADD offers every group whose kind accepts this table's items — including ones the selection is
 * already in, because adding is idempotent (`added: 0`) and hiding a group the moment one of fifty
 * selected rows joined it would make the menu flicker for no reason.
 *
 * REMOVE offers only groups at least one selected row actually belongs to, which is why `ItemRow` /
 * `VocabRow` carry `groupIds`: a "Gỡ khỏi nhóm" menu listing groups nothing is in is a menu where
 * every choice is a no-op.
 */
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
  // `?? []` is load-bearing: the resources page casts listItems' output to ItemRow[], so a loader
  // that forgot `withGroupIds` would land here as undefined rather than as a type error.
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

'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GROUP_KIND_LABELS } from '@/lib/library/group-kinds';
import { addItemsToGroupAction, removeItemsFromGroupAction } from '@/app/actions';
import type { GroupSummary } from '@/lib/library/groups';

export function ItemGroups({
  itemId,
  member,
  addable,
}: {
  itemId: string;
  member: GroupSummary[];
  addable: GroupSummary[];
}) {
  const [isPending, startTransition] = useTransition();

  const add = (groupId: string) =>
    startTransition(async () => {
      const r = await addItemsToGroupAction(groupId, [itemId]);
      toastResult(r, 'Đã thêm vào nhóm');
    });

  const remove = (groupId: string) =>
    startTransition(async () => {
      const r = await removeItemsFromGroupAction(groupId, [itemId]);
      toastResult(r, 'Đã gỡ khỏi nhóm');
    });

  // thien, 2026-10-25: group chips look like the state badge (2px edge, control radius) at a
  // control's height, the add button is always the same dashed square, and one sentence says
  // the item is in no group. The menu ends with a way to make a new group.
  return (
    <div className="flex flex-wrap items-center gap-2">
      {member.length > 0 ? (
        member.map((g) => (
          <Badge key={g.id} variant="outline" size="control" title={`Thuộc nhóm ${g.name}`}>
            <Link href={`/groups/${g.id}`} className="min-w-0 truncate hover:underline">
              {g.name}
            </Link>
            <button
              type="button"
              onClick={() => remove(g.id)}
              disabled={isPending}
              aria-label={`Gỡ khỏi nhóm ${g.name}`}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground md:size-5 [&>svg]:size-3.5"
            >
              <X aria-hidden />
            </button>
          </Badge>
        ))
      ) : (
        <span className="text-sm text-muted-foreground">Chưa thuộc nhóm nào</span>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="dashed"
            size="icon"
            aria-label="Thêm vào nhóm"
            title="Thêm vào nhóm"
            disabled={isPending}
          >
            <Plus aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-w-72 min-w-56">
          {addable.map((g) => (
            <DropdownMenuItem key={g.id} onSelect={() => add(g.id)}>
              <span className="min-w-0 truncate">{g.name}</span>
              <span className="ml-auto pl-3 text-xs whitespace-nowrap text-muted-foreground">
                {GROUP_KIND_LABELS[g.kind]}
              </span>
            </DropdownMenuItem>
          ))}
          {addable.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem asChild>
            <Link href="/groups/new">
              <Plus aria-hidden />
              Nhóm mới
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

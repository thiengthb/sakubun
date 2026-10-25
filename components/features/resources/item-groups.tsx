'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useTransition } from 'react';
import { Plus, X } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ExpandingIconButton } from '@/components/common/expanding-icon-button';
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

  const hasAnyGroup = member.length > 0 || addable.length > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {member.length > 0
          ? member.map((g) => (
              <span
                key={g.id}
                title={`Thuộc nhóm ${g.name}`}
                className="inline-flex items-center gap-1.5 rounded-full border bg-muted py-1 pr-1.5 pl-3 text-sm"
              >
                <Link href={`/groups/${g.id}`} className="hover:underline">
                  {g.name}
                </Link>
                <button
                  type="button"
                  onClick={() => remove(g.id)}
                  disabled={isPending}
                  aria-label={`Gỡ khỏi nhóm ${g.name}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </span>
            ))
          : addable.length > 0 && (
              <span className="text-sm text-muted-foreground">Chưa thuộc nhóm nào</span>
            )}

        {addable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ExpandingIconButton
                icon={Plus}
                label="Thêm vào nhóm"
                variant="dashed"
                disabled={isPending}
              />
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
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!hasAnyGroup && (
          <>
            <span className="text-sm text-muted-foreground">Chưa có nhóm phù hợp.</span>
            <Button asChild variant="dashed">
              <Link href="/groups/new">
                <Plus aria-hidden />
                Thêm
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

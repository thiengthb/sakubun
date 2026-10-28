'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { ChartColumn, CirclePause, CirclePlay, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { toastResult } from '@/lib/core/action-toast';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Explain } from '@/components/common/explain';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteItemAction, setItemSuspendedAction } from '@/app/actions';

export interface EditableItem {
  itemId: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  notes: string | null;
  level?: string;
  suspended: boolean;
}

export function RowActions({
  item,
  kind,
  hideDetail = false,
}: {
  item: EditableItem;
  kind: 'grammar' | 'vocab';
  hideDetail?: boolean;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const noun = kind === 'grammar' ? 'mẫu ngữ pháp' : 'từ vựng';

  const toggleSuspend = () => {
    startTransition(async () => {
      const r = await setItemSuspendedAction(item.itemId, !item.suspended);
      toastResult(r, item.suspended ? 'Đã cho học lại' : 'Đã tạm ngưng');
    });
  };

  const doDelete = () => {
    startTransition(async () => {
      const r = await deleteItemAction(item.itemId);
      if (toastResult(r, 'Đã xoá (lịch sử ôn vẫn được giữ)')) setDeleteOpen(false);
    });
  };

  return (
    <>
      <DropdownMenu>
        <Explain text="Tác vụ">
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Tác vụ"
              className="text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </Explain>
        <DropdownMenuContent align="end" className="min-w-40">
          {!hideDetail && (
            <>
              <DropdownMenuItem asChild>
                <Link href={`/resources/${item.itemId}`}>
                  <ChartColumn className="size-4" /> Chi tiết
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {/* Editing is a page at every width (docs/ui-standard.md: no form in a dialog). */}
          <DropdownMenuItem asChild>
            <Link href={`/resources/${item.itemId}/edit?kind=${kind}`}>
              <Pencil className="size-4" /> Sửa
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              toggleSuspend();
            }}
          >
            {item.suspended ? (
              <>
                <CirclePlay className="size-4" /> Cho học lại
              </>
            ) : (
              <>
                <CirclePause className="size-4" /> Tạm ngưng
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              e.preventDefault();
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-4" /> Xoá
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={<>Xoá {noun} này?</>}
        description={
          <>
            «{item.expression}» sẽ bị xoá khỏi kho và không luyện nữa. Lịch sử ôn cũ vẫn được GIỮ để
            thống kê. Không thể hoàn tác.
          </>
        }
        confirmLabel="Xoá"
        onConfirm={doDelete}
        pending={isPending}
      />
    </>
  );
}

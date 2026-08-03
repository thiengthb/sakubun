'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  ChartColumn,
  CirclePause,
  CirclePlay,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toastResult } from '@/lib/action-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ItemEditForm } from '@/components/resources/item-edit-dialog';
import {
  deleteItemAction,
  setItemSuspendedAction,
} from '@/app/actions';

/** The editable content of a row — FSRS state is deliberately absent (never editable from the UI). */
export interface EditableItem {
  itemId: string;
  expression: string;
  reading: string | null;
  meaningVi: string;
  notes: string | null;
  level?: string;
  suspended: boolean;
}

/**
 * Per-row actions for the resources tables: a single ⋮ menu → Chi tiết · Sửa (content edit dialog) ·
 * Tạm ngưng / Cho học lại · Xóa (confirm dialog). Delete keeps the review history (server preserves
 * ReviewLog); the confirm copy says so. `kind` switches labels + whether the edit form shows the JLPT
 * level. A "Chia sẻ / Thu hồi" option lived here while the app had a public library; it went with the
 * community surface.
 */
export function RowActions({
  item,
  kind,
}: {
  item: EditableItem;
  kind: 'grammar' | 'vocab';
}) {
  const [editOpen, setEditOpen] = useState(false);
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
      if (toastResult(r, 'Đã xóa (lịch sử ôn vẫn được giữ)')) setDeleteOpen(false);
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Tác vụ">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuItem asChild>
            <Link href={`/resources/${item.itemId}`}>
              <ChartColumn className="size-4" /> Chi tiết
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setEditOpen(true);
            }}
          >
            <Pencil className="size-4" /> Sửa
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
            <Trash2 className="size-4" /> Xóa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sửa {noun}</DialogTitle>
            <DialogDescription>
              Chỉ sửa nội dung. Lịch ôn (FSRS) của mục được giữ nguyên.
            </DialogDescription>
          </DialogHeader>
          <ItemEditForm item={item} kind={kind} onDone={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={<>Xóa {noun} này?</>}
        description={
          <>
            «{item.expression}» sẽ bị xóa khỏi kho và không luyện nữa. Lịch sử ôn cũ vẫn được GIỮ để
            thống kê. Không thể hoàn tác.
          </>
        }
        confirmLabel="Xóa"
        onConfirm={doDelete}
        pending={isPending}
      />
    </>
  );
}

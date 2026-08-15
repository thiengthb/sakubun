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
import { toastResult } from '@/lib/core/action-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ItemEditForm } from '@/components/features/resources/item-edit-form';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  deleteItemAction,
  setItemSuspendedAction,
} from '@/app/actions';

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
          <DropdownMenuItem asChild className="md:hidden">
            <Link href={`/resources/${item.itemId}/edit`}>
              <Pencil className="size-4" /> Sửa
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="max-md:hidden"
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

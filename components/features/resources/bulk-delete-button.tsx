'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { BulkActionButton } from '@/components/common/bulk-action-button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { useServerAction } from '@/components/common/use-server-action';
import { deleteItemsAction } from '@/app/actions';

export function BulkDeleteButton({
  ids,
  noun,
  onDone,
}: {
  ids: string[];
  noun: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { run, isPending } = useServerAction(deleteItemsAction, {
    success: (d) => `Đã xóa ${d.deleted} ${noun} (lịch sử ôn vẫn được giữ)`,
    onSuccess: () => {
      setOpen(false);
      onDone?.();
    },
  });
  const doDelete = () => run(ids);

  return (
    <>
      <BulkActionButton
        icon={Trash2}
        label={`Xóa ${ids.length} ${noun}`}
        variant="destructive"
        onClick={() => setOpen(true)}
      />

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={
          <>
            Xóa {ids.length} {noun} đã chọn?
          </>
        }
        description="Các mục này sẽ bị xóa khỏi kho và không luyện nữa. Lịch sử ôn cũ vẫn được GIỮ để thống kê. Không thể hoàn tác."
        confirmLabel={`Xóa ${ids.length} mục`}
        onConfirm={doDelete}
        pending={isPending}
      />
    </>
  );
}

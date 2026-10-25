'use client';

import { CirclePause, CirclePlay } from 'lucide-react';
import { BulkActionButton } from '@/components/common/bulk-action-button';
import { useServerAction } from '@/components/common/use-server-action';
import { setItemsSuspendedAction } from '@/app/actions';

export function BulkSuspendButton({
  ids,
  noun,
  suspend,
  onDone,
}: {
  ids: string[];
  noun: string;
  suspend: boolean;
  onDone?: () => void;
}) {
  const { run, isPending } = useServerAction(setItemsSuspendedAction, {
    success: (d) =>
      suspend ? `Đã tạm ngưng ${d.affected} ${noun}` : `Đã cho học lại ${d.affected} ${noun}`,
    onSuccess: () => onDone?.(),
  });

  return (
    <BulkActionButton
      icon={suspend ? CirclePause : CirclePlay}
      label={suspend ? 'Tạm ngưng' : 'Cho học lại'}
      pendingLabel={suspend ? 'Đang tạm ngưng…' : 'Đang cho học lại…'}
      pending={isPending}
      onClick={() => run(ids, suspend)}
    />
  );
}

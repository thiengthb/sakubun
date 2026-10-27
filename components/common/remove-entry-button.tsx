'use client';

import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServerAction } from '@/components/common/use-server-action';
import { setEntryRemovedAction } from '@/app/admin/actions';
import { cn } from '@/lib/core/utils';

// The admin's "Ẩn" on Kho chung and on an account's page (phase 8, L6), or "Hiện" to undo it. Only
// admin pages render it; the action checks again.
export function RemoveEntryButton({
  entryId,
  removed = false,
  name,
  className,
}: {
  entryId: string;
  removed?: boolean;
  name: string;
  className?: string;
}) {
  const action = useServerAction(setEntryRemovedAction, {
    success: (r) =>
      r.status === 'removed' ? 'Đã ẩn khỏi Kho chung' : 'Đã hiện lại trên Kho chung',
  });
  return (
    <Button
      variant="ghost"
      onClick={() => action.run(entryId, !removed)}
      disabled={action.isPending}
      aria-label={`${removed ? 'Hiện lại' : 'Ẩn'} ${name}`}
      className={cn('relative z-10', className)}
    >
      {removed ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
      {removed ? 'Hiện' : 'Ẩn'}
    </Button>
  );
}

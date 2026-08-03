'use client';

import { Check, Download } from 'lucide-react';
import { Explain } from '@/components/shared/explain';
import { useServerAction } from '@/components/shared/use-server-action';
import { forkItemAction } from '@/app/actions';
import { cn } from '@/lib/utils';

/**
 * Row action for /library: take a shared item into your own kho (fork). Shows a disabled check once
 * owned (`alreadyMine` OR forked this session). The authorship/dup gate is server-side in `forkItem`;
 * `onForked` flips the row to "owned" optimistically so the button updates before revalidation lands.
 */
export function LibraryForkButton({
  id,
  owned,
  onForked,
}: {
  id: string;
  owned: boolean;
  onForked: () => void;
}) {
  const { run: fork, isPending } = useServerAction(forkItemAction, {
    success: 'Đã lấy về kho của bạn',
    onSuccess: () => onForked(),
  });

  if (owned) {
    return (
      <Explain text="Mục này đã có trong kho của bạn — không cần lấy lại.">
        <span
          aria-label="Đã có trong kho"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60"
        >
          <Check className="size-3.5" aria-hidden />
        </span>
      </Explain>
    );
  }

  return (
    <Explain text="Chép mục này vào kho riêng của bạn — từ đó nó có lịch ôn FSRS của riêng bạn và không còn phụ thuộc bản gốc.">
      <button
        type="button"
        onClick={() => fork(id)}
        disabled={isPending}
        aria-label="Lấy về kho"
        className={cn(
          'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          isPending && 'opacity-50',
        )}
      >
        <Download className="size-3.5" aria-hidden />
      </button>
    </Explain>
  );
}

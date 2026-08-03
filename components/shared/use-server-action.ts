'use client';

import { useTransition } from 'react';
import { toastResult } from '@/lib/action-toast';
import type { ActionResult } from '@/app/actions';

/**
 * The shared client shape for firing a Server Action from a button/dialog: a `useTransition` pending flag
 * plus a `run` that awaits the action, surfaces the result through `toastResult` (success toast or the
 * action's error), and calls `onSuccess` with the NARROWED data only on ok. Extracted from the ~8
 * single-action surfaces that hand-repeated `useTransition` + `startTransition(async … toastResult …)`.
 *
 * Deliberately ONE action → ONE pending flag. A surface that shares a single transition across SEVERAL
 * actions (so one in-flight call disables all of them — e.g. `row-actions`) keeps its own `useTransition`;
 * do NOT force this hook there, it would split the shared pending state and change that behavior.
 *
 *   const { run, isPending } = useServerAction(forkItemAction, { success: 'Đã lấy về kho của bạn' });
 *   <Button disabled={isPending} onClick={() => run(id)} />
 */
export function useServerAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  options: {
    success: string | ((data: T) => string);
    onSuccess?: (data: T) => void;
  },
): { run: (...args: Args) => void; isPending: boolean } {
  const [isPending, startTransition] = useTransition();
  const run = (...args: Args) => {
    startTransition(async () => {
      const result = await action(...args);
      if (toastResult(result, options.success)) options.onSuccess?.(result.data);
    });
  };
  return { run, isPending };
}

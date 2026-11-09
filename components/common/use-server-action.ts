'use client';

import { useState, useTransition } from 'react';
import { toastResult } from '@/lib/core/action-toast';
import { callAction, type ActionFailure, type ActionResult } from '@/lib/core/action-result';

/**
 * Runs a server action with a toast for the result (UI v2 B10). A call that never answers becomes a
 * retryable failure with a "Thử lại" button, never a crashed page. `failure` keeps the last failure
 * so a form can show `failure.field`'s message under that field.
 */
export function useServerAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  options: {
    success: string | ((data: T) => string);
    onSuccess?: (data: T) => void;
  },
): { run: (...args: Args) => void; isPending: boolean; failure: ActionFailure | null } {
  const [isPending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ActionFailure | null>(null);
  const run = (...args: Args) => {
    startTransition(async () => {
      const result = await callAction(action, ...args);
      setFailure(result.ok ? null : result);
      if (toastResult(result, options.success, () => run(...args)))
        options.onSuccess?.(result.data);
    });
  };
  return { run, isPending, failure };
}

'use client';

import { useTransition } from 'react';
import { toastResult } from '@/lib/core/action-toast';
import type { ActionResult } from '@/lib/core/action-result';

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

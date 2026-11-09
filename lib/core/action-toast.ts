import { toast } from 'sonner';
import type { ActionResult } from '@/lib/core/action-result';

export const RETRY_LABEL = 'Thử lại';

/**
 * Toasts an action's result. A retryable failure gets a "Thử lại" button when the caller passes
 * `retry` (the same call again).
 */
export function toastResult<T>(
  result: ActionResult<T>,
  success: string | ((data: T) => string),
  retry?: () => void,
): result is { ok: true; data: T } {
  if (result.ok) {
    toast.success(typeof success === 'function' ? success(result.data) : success);
    return true;
  }
  if (result.retryable && retry)
    toast.error(result.error, { action: { label: RETRY_LABEL, onClick: retry } });
  else toast.error(result.error);
  return false;
}

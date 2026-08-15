import { toast } from 'sonner';
import type { ActionResult } from '@/lib/core/action-result';

export function toastResult<T>(
  result: ActionResult<T>,
  success: string | ((data: T) => string),
): result is { ok: true; data: T } {
  if (result.ok) {
    toast.success(typeof success === 'function' ? success(result.data) : success);
    return true;
  }
  toast.error(result.error);
  return false;
}

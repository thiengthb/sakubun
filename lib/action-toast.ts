import { toast } from 'sonner';
import type { ActionResult } from '@/app/actions';

/**
 * Surface a Server Action result to the user: a success toast on ok (fixed string, or built from the
 * payload), the action's own error message otherwise. Every action result should go through here so a
 * failure is never silently swallowed and the wording stays consistent across the app.
 *
 * It's a type predicate, so the ok-branch narrows and follow-up work can chain off it:
 *
 *   if (toastResult(r, 'Đã lưu')) onDone();
 *   if (!toastResult(r, (d) => `Đã thêm ${d.created} mẫu`)) return;
 *   doSomethingWith(r.data); // narrowed
 */
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

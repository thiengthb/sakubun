import type { z } from 'zod';

// UI v2 B10: one failure shape for every server action, so a form or a review screen can treat any
// action the same way.
export type ActionFailure = {
  ok: false;
  /** One short Vietnamese line the learner reads, naming one fix. */
  error: string;
  /** The input the error is about (a form field name), so a form can show it under that field. */
  field?: string;
  /** Sending the same thing again may work (the network or the server hiccuped): offer "Thử lại". */
  retryable?: boolean;
};

export type ActionResult<T = undefined> = { ok: true; data: T } | ActionFailure;

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const err = (
  error: string,
  extra: { field?: string; retryable?: boolean } = {},
): ActionFailure => ({
  ok: false,
  error,
  ...(extra.field ? { field: extra.field } : {}),
  ...(extra.retryable ? { retryable: true } : {}),
});

/** What the learner reads when an action never answered: the request or the server failed. */
export const UNREACHABLE_ERROR = 'Không gửi được. Kiểm tra mạng rồi thử lại.';

/**
 * Runs a server action from the client. A thrown call (offline, the server crashed or restarted
 * mid-deploy) becomes a retryable failure instead of an error that tears down the page.
 */
export async function callAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  ...args: Args
): Promise<ActionResult<T>> {
  try {
    return await action(...args);
  } catch {
    return err(UNREACHABLE_ERROR, { retryable: true });
  }
}

export function zodErrorMessage(e: z.ZodError): string {
  return e.issues.map((i) => i.message).join('; ');
}

export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallback?: string,
): ActionResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  // The first issue's top-level key names the field, so a form can put the message under it.
  const key = parsed.error.issues[0]?.path[0];
  const field = typeof key === 'string' ? key : undefined;
  return err(fallback ?? zodErrorMessage(parsed.error), { field });
}

export function cleanIds(ids: unknown): string[] {
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && !!id) : [];
}

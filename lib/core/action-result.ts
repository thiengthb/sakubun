import type { z } from 'zod';

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const err = (error: string): ActionResult<never> => ({ ok: false, error });

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
  return err(fallback ?? zodErrorMessage(parsed.error));
}

export function cleanIds(ids: unknown): string[] {
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && !!id) : [];
}

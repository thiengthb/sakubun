import type { z } from 'zod';

// The server-action result contract + the small, PURE glue every action repeats. Kept free of any
// server-only import (no `next/cache`) so a client component can `import type { ActionResult }` from
// here without dragging server code into its bundle. The revalidation pair stays local to the action
// modules (it needs `next/cache`, and the paths vary per action). Rationale for NOT wrapping every
// action in a single `withAction()`: the actions are heterogeneous (id+body / ids[] / primitives,
// per-action error copy, P2002 / reason-map special cases, and saveSettings' deliberate no-revalidate),
// so one wrapper would be a leaky abstraction — extract the glue, keep the action (see /code-reuse).

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const err = (error: string): ActionResult<never> => ({ ok: false, error });

/** Zod issues → one human-readable string (was inlined verbatim in ~5 actions). */
export function zodErrorMessage(e: z.ZodError): string {
  return e.issues.map((i) => i.message).join('; ');
}

/**
 * `safeParse` + map the error to a message in one step. On failure returns an `ActionResult` the caller
 * can return directly (`if (!p.ok) return p;`); on success `p.data` is the typed value. `fallback`
 * overrides the derived message for the schemas whose issues aren't user-facing copy.
 */
export function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  fallback?: string,
): ActionResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) return ok(parsed.data);
  return err(fallback ?? zodErrorMessage(parsed.error));
}

/** Non-empty string ids from possibly-junk input (bulk actions). Tolerant: non-arrays → []. */
export function cleanIds(ids: unknown): string[] {
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && !!id) : [];
}

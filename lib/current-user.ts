// Resolve WHO is making the request, at each request boundary. The DB layer (lib/practice.ts) takes
// an explicit userId; THIS module is where that id comes from — a better-auth session for the web
// surface, a per-user MCP token for the machine surface. Centralized so the "who is this?" question
// has exactly one answer per surface (plan 2026-07-21, steps 2.6 / 2.7).

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

/**
 * The signed-in user's id for a Server Component / Server Action, or a redirect to /login when there
 * is no valid session (or the account is banned). Fail-closed: a page that forgets to gate still
 * cannot read data as nobody, because every practice.ts call needs a real userId from here.
 */
export async function getSessionUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) redirect('/login');
  return session.user.id;
}

// There WAS a non-redirecting counterpart here, `getOptionalSessionUser()`. It existed for surfaces
// that rendered something for a guest instead of bouncing to /login, and after /guide was removed
// (2026-08-14) there were none: its last caller was the root layout, feeding an `authed` prop that
// only drove a chromeless guest landing at "/" — and "/" gates with `getSessionUserId()`, so that
// branch could not fire. Kept as a note, not as code: a session lookup per request that nothing
// reads is a cost, and an exported auth helper with no caller invites one.

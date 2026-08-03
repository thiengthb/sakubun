// Resolve the current tenant (userId) at each request boundary. The DB layer (lib/practice.ts) takes
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

/**
 * The signed-in user for a Server Component, or `null` when there is no valid session (or the account
 * is banned). Non-redirecting counterpart to `getSessionUserId` — for the surfaces that render
 * something for guests (the public landing at "/", chrome that hides the sidebar) instead of
 * bouncing to /login.
 */
export async function getOptionalSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) return null;
  return session.user;
}

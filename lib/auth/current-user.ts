import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { accountAccess, refuseAccess, type AccountAccess } from '@/lib/auth/access';
import { userDb, type UserDb } from '@/lib/db/user-db';

export async function getSessionAccess(): Promise<{
  userId: string;
  email: string;
  access: AccountAccess;
} | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    access: accountAccess(session.user),
  };
}

export async function getSessionUserId(): Promise<string> {
  const s = await getSessionAccess();
  if (!s || s.access === 'none') redirect('/login');
  return s.userId;
}

// The logged-in learner's database client: every learning query it runs is theirs (roadmap 7.1).
export async function getUserDb(): Promise<UserDb> {
  return userDb(await getSessionUserId());
}

// For API routes: the caller's id, or the Response that refuses them (401 or 403).
export async function routeUserId(need: 'learner' | 'admin'): Promise<string | Response> {
  const s = await getSessionAccess();
  return refuseAccess(s?.access ?? 'none', need) ?? s!.userId;
}

// Admin pages and actions: anyone else sees a page that does not exist.
export async function getAdminUserId(): Promise<string> {
  const s = await getSessionAccess();
  if (!s || s.access === 'none') redirect('/login');
  if (s.access !== 'admin') notFound();
  return s.userId;
}

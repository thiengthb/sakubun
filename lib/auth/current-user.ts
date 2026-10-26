import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/auth';
import { userDb, type UserDb } from '@/lib/db/user-db';

export async function getSessionUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user || session.user.banned) redirect('/login');
  return session.user.id;
}

// The logged-in learner's database client: every learning query it runs is theirs (roadmap 7.1).
export async function getUserDb(): Promise<UserDb> {
  return userDb(await getSessionUserId());
}

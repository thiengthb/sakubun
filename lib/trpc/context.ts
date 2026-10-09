import { auth } from '@/lib/auth';

export interface TrpcContext {
  user: { id: string; email: string; name: string } | null;
}

export async function createTrpcContext(req: Request): Promise<TrpcContext> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user || session.user.banned) return { user: null };
  const { id, email, name } = session.user;
  return { user: { id, email, name } };
}

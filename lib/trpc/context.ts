// Per-request context for the tRPC transport (the MOBILE surface).
//
// Why this is not `lib/current-user.ts`: that module's `getSessionUserId()` calls `redirect()` on a
// missing session, which is right for a page and wrong here — a redirect thrown inside a tRPC
// procedure surfaces to a native client as an opaque failure instead of a 401 it can act on. And it
// reads `headers()` from `next/headers`, which ties it to a request Next is rendering; the tRPC fetch
// adapter hands us the `Request` directly, so taking headers from the argument keeps this testable
// without a Next request scope.
//
// The ban check is deliberate and mirrors `getSessionUserId`: a banned account is the operator's
// kill switch, and it has to close the mobile door at the same moment it closes the web one.
import { auth } from '@/lib/auth';

export interface TrpcContext {
  /** The signed-in user, or null when there is no valid session (or the account is banned). */
  user: { id: string; email: string; name: string } | null;
}

export async function createTrpcContext(req: Request): Promise<TrpcContext> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user || session.user.banned) return { user: null };
  const { id, email, name } = session.user;
  return { user: { id, email, name } };
}

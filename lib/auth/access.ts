import { isAllowedEmail } from '@/lib/auth/login-policy';

// What an account may do in the app (roadmap 7.2). Every door asks this: pages, API routes, MCP keys
// and OAuth tokens. It fails closed: a banned account, or a role it does not know, gets nothing.
export type AccountAccess = 'admin' | 'learner' | 'none';

export type AccessUser = {
  role?: string | null;
  banned?: boolean | null;
  email?: string | null;
};

export function accountAccess(user: AccessUser | null | undefined): AccountAccess {
  if (!user || user.banned) return 'none';
  // ALLOWED_EMAIL is the admin even if its role was never written (accounts made before the admin plugin).
  if (user.role === 'admin' || isAllowedEmail(user.email)) return 'admin';
  return user.role === 'user' ? 'learner' : 'none';
}

// The short refusal an API route sends when an account may not do what it asked.
export function refuseAccess(access: AccountAccess, need: 'learner' | 'admin'): Response | null {
  if (access === 'none')
    return Response.json({ ok: false, error: 'Cần đăng nhập.' }, { status: 401 });
  if (need === 'admin' && access !== 'admin')
    return Response.json({ ok: false, error: 'Chỉ quản trị dùng được.' }, { status: 403 });
  return null;
}

import { prisma } from '@/lib/db';
import { getSessionUserId } from '@/lib/current-user';
import { AccountView } from '@/components/account/account-view';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const userId = await getSessionUserId();
  const [user, keys, credential, lastSession] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, image: true, createdAt: true },
    }),
    prisma.mcpKey.findMany({
      where: { userId },
      select: { id: true, name: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    // An email/password account is a `credential` provider row — its absence means a Google-only login,
    // for which "đổi mật khẩu" makes no sense, so the view hides that form.
    prisma.account.findFirst({ where: { userId, providerId: 'credential' }, select: { id: true } }),
    // "Đăng nhập gần nhất" = newest web session's createdAt (a session is minted at each login; MCP
    // uses McpKey, not Session, so this is a pure web-login timestamp). Session is a non-tenant auth
    // model — queried freely (see admin/page.tsx).
    prisma.session.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const lastSessionAt = lastSession?.createdAt ?? null;

  return (
    <AccountView
      name={user?.name ?? ''}
      email={user?.email ?? ''}
      image={user?.image ?? null}
      hasPassword={credential !== null}
      joinedAt={user?.createdAt.toISOString() ?? null}
      lastLoginAt={lastSessionAt ? lastSessionAt.toISOString() : null}
      keys={keys.map((k) => ({
        id: k.id,
        name: k.name,
        lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
        createdAt: k.createdAt.toISOString(),
      }))}
    />
  );
}

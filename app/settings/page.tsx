import { SettingsForm } from '@/components/settings/settings-form';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/practice';
import { getSessionUserId } from '@/lib/current-user';
import { readToolUsage } from '@/lib/mcp/usage';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  // Auth gate + the id the auth-layer tables (McpKey/Session/Account) are still keyed by.
  const userId = await getSessionUserId();

  const [settings, user, keys, credential, lastSession, mcpUsage] = await Promise.all([
    getSettings(),
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
    // for which "đổi mật khẩu" makes no sense, so the tab hides that form.
    prisma.account.findFirst({ where: { userId, providerId: 'credential' }, select: { id: true } }),
    // "Đăng nhập gần nhất" = newest web session's createdAt (a session is minted at each login; MCP
    // uses McpKey, not Session, so this is a pure web-login timestamp).
    prisma.session.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    // What Claude has actually called over MCP, rendered next to the token that let it in.
    readToolUsage(),
  ]);

  return (
    <SettingsForm
      initial={settings}
      account={{
        name: user?.name ?? '',
        email: user?.email ?? '',
        image: user?.image ?? null,
        hasPassword: credential !== null,
        joinedAt: user?.createdAt.toISOString() ?? null,
        lastLoginAt: lastSession?.createdAt.toISOString() ?? null,
        keys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
          createdAt: k.createdAt.toISOString(),
        })),
        mcpUsage,
      }}
    />
  );
}

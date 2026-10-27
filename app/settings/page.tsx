import { SettingsForm } from '@/components/features/settings/settings-form';
import { prisma } from '@/lib/db/db';
import { getSettings } from '@/lib/library/practice';
import { getSessionAccess, getSessionUserId } from '@/lib/auth/current-user';
import { userDb } from '@/lib/db/user-db';
import { readToolUsage } from '@/lib/mcp/usage';
import { listConnectedApps } from '@/lib/auth/connected-apps';
import { MCP_RESOURCE } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const userId = await getSessionUserId();
  const isAdmin = (await getSessionAccess())?.access === 'admin';
  const db = userDb(userId);

  const [settings, user, keys, apps, credential, lastSession, mcpUsage] = await Promise.all([
    getSettings(db),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, image: true, createdAt: true },
    }),
    prisma.mcpKey.findMany({
      where: { userId },
      select: { id: true, name: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    listConnectedApps(userId),
    prisma.account.findFirst({ where: { userId, providerId: 'credential' }, select: { id: true } }),
    prisma.session.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    isAdmin ? readToolUsage() : null,
  ]);

  return (
    <SettingsForm
      initial={settings}
      isAdmin={isAdmin}
      mcpUrl={MCP_RESOURCE}
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
        apps: apps.map((a) => ({
          ...a,
          connectedAt: a.connectedAt.toISOString(),
          lastUsedAt: a.lastUsedAt?.toISOString() ?? null,
        })),
        mcpUsage,
      }}
    />
  );
}

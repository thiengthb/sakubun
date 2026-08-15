import { SettingsForm } from '@/components/features/settings/settings-form';
import { prisma } from '@/lib/db/db';
import { getSettings } from '@/lib/library/practice';
import { getSessionUserId } from '@/lib/auth/current-user';
import { readToolUsage } from '@/lib/mcp/usage';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
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
    prisma.account.findFirst({ where: { userId, providerId: 'credential' }, select: { id: true } }),
    prisma.session.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
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

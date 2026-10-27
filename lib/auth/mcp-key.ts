import { createHash, randomBytes } from 'node:crypto';
import { accountAccess } from '@/lib/auth/access';
import { prisma } from '@/lib/db/db';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createMcpKey(
  userId: string,
  name: string,
): Promise<{ id: string; token: string }> {
  const token = randomBytes(32).toString('base64url');
  const key = await prisma.mcpKey.create({
    data: { userId, name, tokenHash: hashToken(token) },
    select: { id: true },
  });
  return { id: key.id, token };
}

// scope 'full' (every key made in Settings) may use any profile; 'planner' is pinned to the planner
// profile (read-only load counts), whatever the URL asks for.
export type McpKeyScope = 'full' | 'planner';

export async function verifyMcpKey(
  token: string,
): Promise<{ userId: string; scope: McpKeyScope } | null> {
  if (!token) return null;
  const key = await prisma.mcpKey.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      userId: true,
      scope: true,
      user: { select: { banned: true, role: true, email: true } },
    },
  });
  if (!key || accountAccess(key.user) === 'none') return null;
  await prisma.mcpKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return { userId: key.userId, scope: key.scope === 'planner' ? 'planner' : 'full' };
}

export async function verifyMcpToken(token: string): Promise<string | null> {
  return (await verifyMcpKey(token))?.userId ?? null;
}

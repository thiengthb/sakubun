import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';

export function hashToken(token: string): string {
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

export async function verifyMcpToken(token: string): Promise<string | null> {
  if (!token) return null;
  const key = await prisma.mcpKey.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, user: { select: { banned: true } } },
  });
  if (!key || key.user.banned) return null;
  await prisma.mcpKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
  return key.userId;
}

// Per-user MCP tokens (plan 2026-07-21, step 2.7). Claude Desktop connects to the central MCP
// endpoint AS a member by sending a personal bearer token; the server stores only a SHA-256 hash of
// it (never the token) and resolves the owning userId on each request. Deleting the McpKey row — or
// banning the user — revokes access instantly (the centralized kill switch). Deliberately NOT the
// better-auth api-key plugin (peer-dep / zod-v4 conflict, see lib/auth.ts); same bearer pattern
// todo/yakudoku use.

import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';

/** SHA-256 hex of a token — the only form ever persisted or compared. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Mint a fresh MCP token for a user and store ONLY its hash. Returns the plaintext token ONCE (the
 * caller shows it to the user a single time — it can never be recovered afterwards).
 */
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

/**
 * Resolve a bearer token to its owner's userId, or null when it is unknown/revoked or the owner is
 * banned. Touches lastUsedAt for the account view. Banned owner → null so the MCP route 401s
 * immediately even on a still-valid token (the kill switch reaches the machine surface too).
 */
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

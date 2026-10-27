// The apps a learner let into sakubun through OAuth (claude.ai, ChatGPT), and taking one back out
// (roadmap 4.2). An app is "connected" while it holds a consent; /api/mcp asks for that consent on every
// call (lib/auth/mcp-oauth.ts), so revoking cuts the app off at once, not when its access token expires.
import { prisma } from '@/lib/db/db';

export type ConnectedApp = {
  clientId: string;
  name: string;
  uri: string | null;
  connectedAt: Date;
  /** The newest token the app got, by sign-in or refresh; null when none is on record. */
  lastUsedAt: Date | null;
};

export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const consents = await prisma.oauthConsent.findMany({
    where: { userId },
    select: {
      clientId: true,
      createdAt: true,
      oauthclient: { select: { name: true, uri: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const byClient = new Map<string, ConnectedApp>();
  for (const c of consents) {
    if (byClient.has(c.clientId)) continue;
    byClient.set(c.clientId, {
      clientId: c.clientId,
      name: c.oauthclient.name?.trim() || 'Ứng dụng không tên',
      uri: c.oauthclient.uri,
      connectedAt: c.createdAt,
      lastUsedAt: null,
    });
  }
  if (byClient.size === 0) return [];
  const latest = await prisma.oauthRefreshToken.groupBy({
    by: ['clientId'],
    where: { userId, clientId: { in: [...byClient.keys()] } },
    _max: { createdAt: true },
  });
  for (const row of latest) {
    const app = byClient.get(row.clientId);
    if (app) app.lastUsedAt = row._max.createdAt;
  }
  return [...byClient.values()];
}

/**
 * Whether any AI app can reach this learner's data: an OAuth consent (claude.ai, ChatGPT) or a pasted
 * full MCP token (Claude Desktop). Phân tích points a learner with neither at the guide (roadmap 7.3b).
 */
export async function hasAiConnection(userId: string): Promise<boolean> {
  const [consents, keys] = await Promise.all([
    prisma.oauthConsent.count({ where: { userId } }),
    // A planner token only reads review counts for a scheduling bot; it cannot tutor.
    prisma.mcpKey.count({ where: { userId, scope: 'full' } }),
  ]);
  return consents + keys > 0;
}

/** Whether this learner still lets this app in: what /api/mcp checks on each OAuth call. */
export async function hasConsent(userId: string, clientId: string): Promise<boolean> {
  return (await prisma.oauthConsent.count({ where: { userId, clientId } })) > 0;
}

/**
 * Takes the app's consent away and revokes its tokens, so its next call and its next refresh both
 * fail. Other learners who use the same app keep theirs. Returns false when the app was not connected.
 */
export async function revokeConnectedApp(
  userId: string,
  clientId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const [consents] = await prisma.$transaction([
    prisma.oauthConsent.deleteMany({ where: { userId, clientId } }),
    prisma.oauthRefreshToken.updateMany({
      where: { userId, clientId, revoked: null },
      data: { revoked: now },
    }),
    prisma.oauthAccessToken.updateMany({
      where: { userId, clientId, revoked: null },
      data: { revoked: now },
    }),
  ]);
  return consents.count > 0;
}

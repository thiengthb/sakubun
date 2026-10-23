import { verifyJwsAccessToken } from 'better-auth/oauth2';
import { auth, AUTH_ISSUER, MCP_RESOURCE } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/db';

// OAuth access tokens on /api/mcp (roadmap 4.1). better-auth signs them as JWTs bound to MCP_RESOURCE;
// they are checked locally against the provider's own keys, then the account must still be allowed.

// The user a verified token speaks for, or null when it carries none or is DPoP-bound (the route only
// reads bearer tokens, so a sender-constrained token cannot be honoured here).
export function oauthSubject(claims: Record<string, unknown>): string | null {
  if (claims.cnf !== undefined) return null;
  return typeof claims.sub === 'string' && claims.sub !== '' ? claims.sub : null;
}

const jwksCacheKey = {};

export async function verifyMcpOAuthToken(token: string): Promise<{ userId: string } | null> {
  if (token.split('.').length !== 3) return null;
  let claims: Record<string, unknown>;
  try {
    claims = await verifyJwsAccessToken(token, {
      jwksFetch: () => auth.api.getJwks(),
      jwksCacheKey,
      verifyOptions: { issuer: AUTH_ISSUER, audience: MCP_RESOURCE },
    });
  } catch {
    return null;
  }
  const userId = oauthSubject(claims);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { banned: true } });
  return user && !user.banned ? { userId } : null;
}

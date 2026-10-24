import { withMcpAuth } from 'mcp-handler';
import { mcpHandlers } from '@/lib/mcp/server';
import { parseProfile } from '@/lib/mcp/profiles';
import { verifyMcpKey } from '@/lib/auth/mcp-key';
import { verifyMcpOAuthToken } from '@/lib/auth/mcp-oauth';
import { MCP_RESOURCE } from '@/lib/auth/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// No parameter (or the old name full) = the v2 tools; ?profile=planner = load counts only.
async function byProfile(req: Request): Promise<Response> {
  const scope = (req as Request & { auth?: { extra?: { scope?: string } } }).auth?.extra?.scope;
  const asked = parseProfile(new URL(req.url).searchParams.get('profile'));
  const profile = scope === 'planner' ? 'planner' : asked;
  if (!profile) return Response.json({ error: 'unknown profile' }, { status: 400 });
  return mcpHandlers[profile](req);
}

const authedHandler = withMcpAuth(
  byProfile,
  // A key made in Settings (Claude Desktop, Hermes) or an OAuth access token (claude.ai, ChatGPT,
  // roadmap 4.1). OAuth tokens get the full v2 set, like a 'full' key.
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    const key = await verifyMcpKey(bearerToken);
    if (key) {
      return {
        token: bearerToken,
        clientId: key.userId,
        scopes: [key.scope],
        extra: { userId: key.userId, scope: key.scope },
      };
    }
    const oauth = await verifyMcpOAuthToken(bearerToken);
    if (!oauth) return undefined;
    return {
      token: bearerToken,
      clientId: oauth.userId,
      scopes: ['full'],
      extra: { userId: oauth.userId, scope: 'full' },
    };
  },
  // The 401 points claude.ai at the metadata on the public origin, not the container's own URL.
  { required: true, resourceUrl: new URL(MCP_RESOURCE).origin },
);

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };

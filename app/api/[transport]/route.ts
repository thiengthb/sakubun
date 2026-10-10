import { withMcpAuth } from 'mcp-handler';
import { mcpHandlers } from '@/lib/mcp/server';
import { parseProfile } from '@/lib/mcp/profiles';
import { verifyMcpKey } from '@/lib/auth/mcp-key';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// ?profile=tutor serves the trimmed tool set for a self-hosted model; no parameter = every tool.
async function byProfile(req: Request): Promise<Response> {
  const scope = (req as Request & { auth?: { extra?: { scope?: string } } }).auth?.extra?.scope;
  const asked = parseProfile(new URL(req.url).searchParams.get('profile'));
  const profile = scope === 'planner' ? 'planner' : asked;
  if (!profile) return Response.json({ error: 'unknown profile' }, { status: 400 });
  return mcpHandlers[profile](req);
}

const authedHandler = withMcpAuth(
  byProfile,
  async (_req, bearerToken) => {
    const key = bearerToken ? await verifyMcpKey(bearerToken) : null;
    if (!key) return undefined;
    return {
      token: bearerToken as string,
      clientId: key.userId,
      scopes: [key.scope],
      extra: { userId: key.userId, scope: key.scope },
    };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };

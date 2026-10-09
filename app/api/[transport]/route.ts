import { withMcpAuth } from 'mcp-handler';
import { mcpHandlers } from '@/lib/mcp/server';
import { parseProfile } from '@/lib/mcp/profiles';
import { verifyMcpToken } from '@/lib/auth/mcp-key';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// ?profile=tutor serves the trimmed tool set for a self-hosted model; no parameter = every tool.
async function byProfile(req: Request): Promise<Response> {
  const profile = parseProfile(new URL(req.url).searchParams.get('profile'));
  if (!profile) return Response.json({ error: 'unknown profile' }, { status: 400 });
  return mcpHandlers[profile](req);
}

const authedHandler = withMcpAuth(
  byProfile,
  async (_req, bearerToken) => {
    const userId = bearerToken ? await verifyMcpToken(bearerToken) : null;
    if (!userId) return undefined;
    return { token: bearerToken as string, clientId: userId, scopes: [], extra: { userId } };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };

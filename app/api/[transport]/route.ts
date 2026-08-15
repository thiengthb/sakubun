import { withMcpAuth } from 'mcp-handler';
import { mcpHandler } from '@/lib/mcp/server';
import { verifyMcpToken } from '@/lib/auth/mcp-key';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const authedHandler = withMcpAuth(
  mcpHandler,
  async (_req, bearerToken) => {
    const userId = bearerToken ? await verifyMcpToken(bearerToken) : null;
    if (!userId) return undefined;
    return { token: bearerToken as string, clientId: userId, scopes: [], extra: { userId } };
  },
  { required: true },
);

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };

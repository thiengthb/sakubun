import { withMcpAuth } from 'mcp-handler';
import { mcpHandler } from '@/lib/mcp/server';
import { verifyMcpToken } from '@/lib/mcp-key';

// MCP needs fresh data per request + the Node runtime (Prisma). Multi-user (plan 2026-07-21): the
// endpoint is authed with a PER-USER bearer token (NOT forward-auth — this is a machine client). The
// token is verified server-side against McpKey; a missing/unknown/revoked token, or a banned owner,
// is rejected with 401 (required: true). Each tool resolves its userId from the auth context.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

// Resolve the bearer token to its owner. Returning undefined → withMcpAuth answers 401. The userId is
// stashed in `extra` for the tools to read (see getMcpUserId in lib/mcp/tool-kit.ts).
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

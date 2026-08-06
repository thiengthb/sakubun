import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createTrpcContext } from '@/lib/trpc/context';
import { appRouter } from '@/lib/trpc/router';

// The mobile transport. Same two requirements as the MCP route: fresh data per request, and the Node
// runtime because Prisma runs here. Auth is NOT in this file on purpose — it is one `protectedProcedure`
// guard in lib/trpc/init.ts, so a new procedure cannot forget it by forgetting a line here.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function handler(req: Request) {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTrpcContext(req),
  });
}

export { handler as GET, handler as POST };

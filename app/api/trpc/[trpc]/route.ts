import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createTrpcContext } from '@/lib/trpc/context';
import { appRouter } from '@/lib/trpc/router';

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

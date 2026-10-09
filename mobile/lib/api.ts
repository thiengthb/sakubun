import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@/lib/trpc/router';
import { authClient } from '~/lib/auth-client';
import { API_BASE_URL } from '~/lib/config';

export const queryClient = new QueryClient();

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/api/trpc`,
      headers() {
        const cookie = authClient.getCookie();
        return cookie ? { Cookie: cookie } : {};
      },
      fetch: (url, options) => fetch(url as string, { ...options, credentials: 'omit' }),
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });

export function isUnauthorized(error: unknown): boolean {
  return error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED';
}

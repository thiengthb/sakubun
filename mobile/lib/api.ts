import { QueryClient } from '@tanstack/react-query';
import { createTRPCClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import type { AppRouter } from '@/lib/trpc/router';
import { authClient } from '~/lib/auth-client';
import { API_BASE_URL } from '~/lib/config';

// `import type` above is load-bearing: it is erased at compile time, so the server's router (and with
// it Prisma, better-auth's server half, the whole Node tree) never enters the Metro bundle. The only
// thing crossing the boundary is a TYPE. Enforced by lib/mobile-imports.test.ts in the repo root.

export const queryClient = new QueryClient();

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${API_BASE_URL}/api/trpc`,
      headers() {
        // Sync in better-auth 1.6; becomes a Promise in 1.7 (see the note in lib/auth-client.ts).
        const cookie = authClient.getCookie();
        return cookie ? { Cookie: cookie } : {};
      },
      // We attach the cookie ourselves, so the platform must not also try to manage a cookie store —
      // on native that would race with the SecureStore jar and send a stale session.
      fetch: (url, options) => fetch(url as string, { ...options, credentials: 'omit' }),
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({ client: trpcClient, queryClient });

/**
 * True when a failure means "this session is gone", not "the network is down".
 *
 * The distinction matters: the first should send the learner to /login, the second must NOT — bouncing
 * someone to a login screen because they walked into a lift is how an offline-capable app loses trust.
 */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof TRPCClientError && error.data?.code === 'UNAUTHORIZED';
}

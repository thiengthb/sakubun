// THE mobile router. One place to see the whole surface the native app is allowed to touch.
//
// Every procedure here is a thin call into `lib/*.ts` with an `.output()` schema. If a procedure ever
// wants to compute something, that computation belongs in `lib/` where the web surface and the MCP
// tools can reach it too — otherwise the app grows its own private version of the domain, which is the
// exact failure this transport was chosen to avoid (ADR 0001).
import { z } from 'zod';
import { buildMobileSnapshot, mobileSnapshotSchema } from '@/lib/mobile-snapshot';
import { protectedProcedure, router } from '@/lib/trpc/init';

export const appRouter = router({
  /**
   * Who the bearer of this session is. The app calls it right after sign-in: it is the cheapest proof
   * that the whole native auth path works end to end (cookie jar in SecureStore -> `cookie` header ->
   * better-auth session -> context), and it is what a "still signed in?" check hits on launch.
   */
  me: protectedProcedure
    .output(z.object({ id: z.string(), email: z.string(), name: z.string() }))
    .query(({ ctx }) => ctx.user),

  /** The whole library, for the client to cache. See lib/mobile-snapshot.ts for why it is not the backup format. */
  snapshot: protectedProcedure
    .output(mobileSnapshotSchema)
    .query(() => buildMobileSnapshot()),
});

/** Type-only export for the Expo app. It MUST be imported with `import type` — a runtime import of this
 *  module from `mobile/` would drag Prisma into the Metro bundle (ADR 0001, decision 6). */
export type AppRouter = typeof appRouter;

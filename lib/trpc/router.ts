// THE mobile router. One place to see the whole surface the native app is allowed to touch.
//
// Every procedure here is a thin call into `lib/*.ts` with an `.output()` schema. If a procedure ever
// wants to compute something, that computation belongs in `lib/` where the web surface and the MCP
// tools can reach it too — otherwise the app grows its own private version of the domain, which is the
// exact failure this transport was chosen to avoid (ADR 0001).
import { z } from 'zod';
import { isGoogleEnabled } from '@/lib/google-enabled';
import { buildMobileSnapshot, mobileSnapshotSchema } from '@/lib/mobile-snapshot';
import { buildMobileStats, mobileStatsSchema } from '@/lib/mobile-stats';
import { protectedProcedure, publicProcedure, router } from '@/lib/trpc/init';

export const appRouter = router({
  /**
   * Which sign-in methods this server actually offers. PUBLIC on purpose — the login screen has to
   * render before there is a session, and it must not offer a Google button that would dead-end.
   *
   * It has to be asked at RUNTIME, not baked in. The web has the same problem for a different reason
   * (see lib/google-enabled.ts: `next build` runs before .env.docker exists), and the app has it worse
   * — a build is installed on a phone and cannot be re-baked when the server's config changes.
   *
   * Leaks nothing: the web login page already shows this same boolean to anyone who loads it.
   */
  authConfig: publicProcedure
    .output(z.object({ googleEnabled: z.boolean() }))
    .query(() => ({ googleEnabled: isGoogleEnabled() })),

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

  /**
   * Progress, already computed. Separate from `snapshot` because the two change on different clocks:
   * the library is edited a few times a week, these numbers move with every review — and a client that
   * had to refetch the whole library to refresh a streak would refetch it constantly.
   */
  stats: protectedProcedure.output(mobileStatsSchema).query(() => buildMobileStats()),
});

/** Type-only export for the Expo app. It MUST be imported with `import type` — a runtime import of this
 *  module from `mobile/` would drag Prisma into the Metro bundle (ADR 0001, decision 6). */
export type AppRouter = typeof appRouter;

import { z } from 'zod';
import { isGoogleEnabled } from '@/lib/google-enabled';
import { buildMobileSnapshot, mobileSnapshotSchema } from '@/lib/mobile-snapshot';
import { buildMobileStats, mobileStatsSchema } from '@/lib/mobile-stats';
import { protectedProcedure, publicProcedure, router } from '@/lib/trpc/init';

export const appRouter = router({
  authConfig: publicProcedure
    .output(z.object({ googleEnabled: z.boolean() }))
    .query(() => ({ googleEnabled: isGoogleEnabled() })),

  me: protectedProcedure
    .output(z.object({ id: z.string(), email: z.string(), name: z.string() }))
    .query(({ ctx }) => ctx.user),

  snapshot: protectedProcedure
    .output(mobileSnapshotSchema)
    .query(() => buildMobileSnapshot()),

  stats: protectedProcedure.output(mobileStatsSchema).query(() => buildMobileStats()),
});

export type AppRouter = typeof appRouter;

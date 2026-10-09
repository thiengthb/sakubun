import { initTRPC, TRPCError } from '@trpc/server';
import type { TrpcContext } from '@/lib/trpc/context';

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' });
  }
  return next({ ctx: { user: ctx.user } });
});

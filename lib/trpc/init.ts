// tRPC roots for the mobile transport. See docs/adr/0001-mobile-app-architecture.md.
//
// NO TRANSFORMER, ON PURPOSE. Without superjson, tRPC types the client's output as the server's type
// — so a `Date` returned by Prisma types as `Date` on the client while the wire actually carries an
// ISO string. That is a type that LIES, and the mobile cache persists this JSON to disk where a
// revived Date would be one more thing to get wrong. Instead every procedure declares an `.output()`
// Zod schema with explicit ISO strings: the client's type is then the schema (honest by construction),
// and a Date leaking through fails the schema loudly in a test rather than quietly at 3am on a phone.
//
// A procedure is a THIN wrapper over `lib/*.ts` — never business logic. That is what makes dropping
// tRPC a transport rewrite instead of a product rewrite (the same discipline `lib/mcp/tools/*` keeps).
import { initTRPC, TRPCError } from '@trpc/server';
import type { TrpcContext } from '@/lib/trpc/context';

const t = initTRPC.context<TrpcContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Call procedures directly, with a context you supply. Lets a test drive the real guard and the real
 *  `.output()` schema without standing up HTTP — the transport is not what those tests are about. */
export const createCallerFactory = t.createCallerFactory;

/**
 * Everything that touches learning data. The learning tables have no `userId` column — the boundary is
 * the LOGIN (AGENTS.md) — so this guard IS the boundary for this surface, exactly as
 * `withMcpAuth({required:true})` is for MCP.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Chưa đăng nhập.' });
  }
  return next({ ctx: { user: ctx.user } });
});

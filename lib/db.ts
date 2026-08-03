import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/lib/generated/prisma/client';

// User-owned models (multi-user, plan 2026-07-21). EVERY query on one of these MUST be scoped by
// `userId` — enforced fail-closed by the tenancy guard below. Non-tenant models (better-auth's
// user/session/account/verification, and mcp_key) are exempt: they are the auth layer itself.
const TENANT_MODELS = new Set([
  'Item',
  'SrsState',
  'ReviewLog',
  'Sentence',
  'Settings',
  'Group',
  'GroupMember',
  // The learner's ability estimate (2026-07-26). One row per user and as private as their review
  // history — a leak here would expose how well another member performs.
  'LearnerAbility',
  // Claude's prose notes ABOUT the learner (2026-07-27). At least as private as the ability estimate:
  // these are observations about a person, written by a model, and must never cross tenants.
  'LearnerNote',
]);

/** A `where` / `create` object carries a concrete tenant scope iff it names a non-null `userId`. */
function scoped(obj: unknown): boolean {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    (obj as Record<string, unknown>).userId !== undefined &&
    (obj as Record<string, unknown>).userId !== null
  );
}

/**
 * Fail-closed multi-tenancy guard (plan 2026-07-21, step 2.5). A Prisma client extension that THROWS
 * when a query on a user-owned model is not scoped by `userId` — so a forgotten filter is a loud
 * denial, never a silent cross-user data leak. It only ENFORCES presence; the concrete scoping is
 * written explicitly at each call site in `lib/practice.ts` (the DB choke point) and the read-only
 * reporting modules. Prisma 5+ "extended where-unique" lets `update`/`delete`/`findUnique` carry the
 * `userId` filter alongside the unique key, so the rule is uniform across every operation.
 */
function requireTenantScope(model: string, operation: string, args: unknown): void {
  if (!TENANT_MODELS.has(model)) return;
  const a = (args ?? {}) as { where?: unknown; data?: unknown; create?: unknown };
  const fail = (what: string): never => {
    throw new Error(
      `Tenancy guard: ${model}.${operation} is missing a userId ${what} — every query on a ` +
        `user-owned model must be scoped to the current user (see lib/db.ts).`,
    );
  };

  switch (operation) {
    case 'create':
      if (!scoped(a.data)) fail('in data');
      return;
    case 'createMany': {
      const rows = Array.isArray(a.data) ? a.data : [a.data];
      if (!rows.every(scoped)) fail('in every data row');
      return;
    }
    case 'upsert':
      if (!scoped(a.where)) fail('filter');
      if (!scoped(a.create)) fail('in create');
      return;
    default:
      // findUnique/findFirst/findMany/count/aggregate/groupBy/update/updateMany/delete/deleteMany.
      if (!scoped(a.where)) fail('filter');
      return;
  }
}

// Single shared Prisma instance (global-cached to survive Next hot-reload without connection storms).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  });
  return new PrismaClient({ adapter }).$extends({
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          requireTenantScope(model, operation, args);
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Prisma, PrismaClient } from '@/lib/generated/prisma/client';
import { isLearningModel } from '@/lib/db/learner-scope';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  });
  return new PrismaClient({ adapter });
}

// The client with no learner guard. Only `userDb` (lib/db/user-db.ts) builds on it; the scan in
// lib/db/raw-access.test.ts keeps every other file off it.
export const unguardedPrisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = unguardedPrisma;

// Roadmap 7.1d: the shared client refuses the eight learning tables, so a query that forgot its
// learner fails instead of reading everyone's rows. Raw SQL is not a model operation and passes;
// the same scan keeps it to lib/db and the system restore.
const learningGuard = Prisma.defineExtension({
  name: 'learning-guard',
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        if (isLearningModel(model)) {
          throw new Error(
            `${model}.${operation} needs a learner: use userDb(userId) from lib/db/user-db.ts.`,
          );
        }
        return query(args);
      },
    },
  },
});

export const prisma = unguardedPrisma.$extends(learningGuard);

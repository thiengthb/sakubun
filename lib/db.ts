import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@/lib/generated/prisma/client';

// This app is single-user. There is no tenant column on the learning data (Item, SrsState, ReviewLog,
// Sentence, Settings, LearnerAbility, LearnerNote, CalibrationProposal), so there is nothing for a
// tenancy guard to enforce.
//
// A fail-closed guard lived here while the app was multi-user: it threw when a query on a user-owned
// model was not scoped by `userId`, turning a forgotten filter into a loud denial instead of a silent
// cross-user leak. It went out with the `userId` columns themselves — a guard checking for a field
// that no longer exists would reject every query. The multi-user version is preserved on the
// `feat/multiuser-community` branch; restoring it means restoring the columns with it.
//
// The remaining boundary is AUTHENTICATION, not tenancy: nothing is reachable without a session
// (lib/current-user.ts) or a valid MCP token, and account creation closes after the first user
// (lib/auth.ts). That is what keeps a stranger out now.

// Single shared Prisma instance (global-cached to survive Next hot-reload without connection storms).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || 'file:./dev.db',
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

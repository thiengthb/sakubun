import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

// Type only: importing lib/db/db for real would open the database before createTestDb sets its URL.
type SharedClient = typeof import('@/lib/db/db').prisma;

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..', '..');
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'prisma', 'migrations');

export function createTestDb(prefix: string): string {
  const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), prefix)), 'test.db');
  applyMigrations(dbFile);
  const url = `file:${dbFile.replace(/\\/g, '/')}`;
  process.env.DATABASE_URL = url;
  return url;
}

// `before` stops at the first migration whose name sorts at or after it: a database as an older
// release left it, for tests of old backups.
export function applyMigrations(dbFile: string, { before }: { before?: string } = {}): void {
  const db = new Database(dbFile);
  try {
    const migrations = readdirSync(MIGRATIONS_DIR)
      .filter((name) => statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
      .filter((name) => !before || name < before)
      .sort();
    if (migrations.length === 0) {
      throw new Error(`No migrations found in ${MIGRATIONS_DIR} — cannot build a test schema.`);
    }
    for (const name of migrations) {
      db.exec(readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8'));
    }
  } finally {
    db.close();
  }
}

// Child rows first: ReviewLog/Turn/Sentence/SrsState/GroupMember all point at Item or Group, so
// clearing Item before them would trip the foreign keys SQLite does enforce here.
const LEARNING_TABLES = [
  'ReviewLog',
  'Turn',
  'Sentence',
  'SrsState',
  'GroupMember',
  'Group',
  'Item',
  'Settings',
  'Script',
] as const;

// One reset for every suite that owns a throwaway DB. Deliberately clears the WHOLE learning graph
// rather than the subset a given suite happens to write: a suite that seeds through lib/practice
// touches tables it never names, and a partial reset leaks those rows into the next test.
// Raw SQL, because the shared client refuses learning tables (roadmap 7.1d).
export async function resetLearningData(
  prisma: Pick<SharedClient, '$executeRawUnsafe'>,
): Promise<void> {
  for (const table of LEARNING_TABLES) await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
}

// A learner account for suites that read or write through `userDb` (roadmap 7.1).
export async function createTestUser(
  prisma: Pick<SharedClient, 'user'>,
  id: string,
): Promise<string> {
  await prisma.user.upsert({
    where: { id },
    create: { id, name: id, email: `${id}@example.test` },
    update: {},
  });
  return id;
}

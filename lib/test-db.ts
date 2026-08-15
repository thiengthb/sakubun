import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import type { PrismaClient } from '@/lib/generated/prisma/client';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'prisma', 'migrations');

export function createTestDb(prefix: string): string {
  const dbFile = path.join(mkdtempSync(path.join(os.tmpdir(), prefix)), 'test.db');
  applyMigrations(dbFile);
  const url = `file:${dbFile.replace(/\\/g, '/')}`;
  process.env.DATABASE_URL = url;
  return url;
}

export function applyMigrations(dbFile: string): void {
  const db = new Database(dbFile);
  try {
    const migrations = readdirSync(MIGRATIONS_DIR)
      .filter((name) => statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
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

// Child rows first: ReviewLog/Sentence/SrsState/GroupMember all point at Item or Group, so
// clearing Item before them would trip the foreign keys SQLite does enforce here.
const LEARNING_TABLES = [
  'reviewLog',
  'sentence',
  'srsState',
  'groupMember',
  'group',
  'item',
  'calibrationProposal',
  'learnerNote',
  'learnerAbility',
  'settings',
] as const satisfies readonly (keyof PrismaClient)[];

// One reset for every suite that owns a throwaway DB. Deliberately clears the WHOLE learning graph
// rather than the subset a given suite happens to write: a suite that seeds through lib/practice
// touches tables it never names, and a partial reset leaks those rows into the next test.
export async function resetLearningData(prisma: PrismaClient): Promise<void> {
  for (const table of LEARNING_TABLES) {
    await (prisma[table] as { deleteMany: (args: object) => Promise<unknown> }).deleteMany({});
  }
}

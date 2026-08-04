import { rmSync } from 'node:fs';
import path from 'node:path';
import { applyMigrations } from '../lib/test-db';
import { E2E_DB_FILE } from './fixtures';

// Rebuild the throwaway DB schema before the run by APPLYING THE COMMITTED MIGRATIONS — the same path
// lib/test-db.ts uses for the unit tests, and the same one production gets from `prisma migrate deploy`.
//
// It used to shell out to `prisma db push`, which Prisma 7 hard-blocks for an AI agent (it needs
// PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION) — so `npx playwright test` could not be run at all
// without a human in the loop, while `npm test` could. Applying the SQL needs no CLI and no subprocess.
//
// Seeding the account is NOT done here — importing the app's auth module into the Playwright node
// context can't resolve the `@/` path alias, so the specs seed via HTTP sign-up + a direct DB write.
export default async function globalSetup() {
  const dbPath = path.join(process.cwd(), E2E_DB_FILE);
  for (const suffix of ['', '-wal', '-shm', '-journal'])
    rmSync(`${dbPath}${suffix}`, { force: true });
  applyMigrations(dbPath);
}

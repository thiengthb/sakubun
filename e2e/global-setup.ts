import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { E2E_DB_FILE } from './fixtures';

// Rebuild the throwaway DB schema before the run. Deleting the file first + a plain `db push` resets it
// WITHOUT `--force-reset` (which Prisma 7 hard-blocks for an AI agent). Seeding the account is NOT done
// here — importing the app's auth module into the Playwright node context can't resolve the `@/` path
// alias, so the spec's beforeAll seeds via HTTP sign-up + a direct emailVerified flip instead.
export default async function globalSetup() {
  const projectRoot = process.cwd();
  const dbPath = path.join(projectRoot, E2E_DB_FILE);
  const dbUrl = `file:${dbPath}`;
  process.env.DATABASE_URL = dbUrl;
  for (const suffix of ['', '-wal', '-shm', '-journal'])
    rmSync(`${dbPath}${suffix}`, { force: true });
  execSync('npx prisma db push --accept-data-loss', {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'inherit',
  });
}

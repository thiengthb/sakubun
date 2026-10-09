import { rmSync } from 'node:fs';
import path from 'node:path';
import { applyMigrations } from '../lib/test-db';
import { E2E_DB_FILE } from './fixtures';

export default async function globalSetup() {
  const dbPath = path.join(process.cwd(), E2E_DB_FILE);
  for (const suffix of ['', '-wal', '-shm', '-journal'])
    rmSync(`${dbPath}${suffix}`, { force: true });
  applyMigrations(dbPath);
}

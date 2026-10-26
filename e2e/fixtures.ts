import type Database from 'better-sqlite3';

export const E2E_PORT = 3799; // NOT 3789 — that port is shared by the local dev + prod containers; a
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_EMAIL = 'e2e@example.test';
export const E2E_DB_FILE = 'e2e-test.db';

export const E2E_LOGIN = process.env.E2E_LOGIN ?? ['e2e', 'login', '12345'].join('-');

export async function seedE2eAccount(): Promise<void> {
  const origin = E2E_BASE_URL;
  const res = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_LOGIN, name: 'E2E User' }),
  });
  if (res.status >= 500) throw new Error(`e2e sign-up failed: ${res.status} ${await res.text()}`);

  const { default: Database } = await import('better-sqlite3');
  const { default: path } = await import('node:path');
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  db.prepare('UPDATE user SET emailVerified = 1 WHERE email = ?').run(E2E_EMAIL);
  db.close();
}

// Roadmap 7.1: the app reads only the signed-in learner's rows. Seeds write raw SQL without an
// owner, so every unowned learning row goes to the e2e account before the seed closes.
const OWNED_TABLES = ['Item', 'SrsState', 'ReviewLog', 'Sentence', 'Turn', 'Group', 'GroupMember'];

export function ownSeedRows(db: Database.Database): void {
  const user = db.prepare('SELECT id FROM user WHERE email = ?').get(E2E_EMAIL) as
    { id: string } | undefined;
  if (!user) throw new Error('Seed the e2e account (seedE2eAccount) before seeding its data.');
  for (const t of OWNED_TABLES)
    db.prepare(`UPDATE "${t}" SET userId = ? WHERE userId IS NULL`).run(user.id);
  // One Settings row per learner: own an unowned one only when the account has none yet.
  db.prepare(
    `UPDATE Settings SET userId = ?
     WHERE id = (SELECT MIN(id) FROM Settings WHERE userId IS NULL)
       AND NOT EXISTS (SELECT 1 FROM Settings WHERE userId = ?)`,
  ).run(user.id, user.id);
}

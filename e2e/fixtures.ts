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

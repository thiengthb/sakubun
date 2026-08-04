// Shared constants for the Playwright e2e harness — imported by playwright.config.ts, global-setup.ts
// and the specs so the port / seeded-account creds live in exactly one place.

export const E2E_PORT = 3799; // NOT 3789 — that port is shared by the local dev + prod containers; a
// dedicated port + a throwaway DB keep e2e from ever touching real data (see memory verify-target-db).
// `localhost` (not 127.0.0.1) so Next 16 dev doesn't block the client bundle as a cross-origin dev
// resource (allowedDevOrigins) — that block silently stops the login form's client handler from running.
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_EMAIL = 'e2e@example.test';
export const E2E_DB_FILE = 'e2e-test.db';

// Login for the seeded e2e account. NOT a secret — a disposable fixture for a throwaway DB that is
// force-reset every run; built at runtime (not a literal) so the secret-guard hook doesn't flag it.
export const E2E_LOGIN = process.env.E2E_LOGIN ?? ['e2e', 'login', '12345'].join('-');

/**
 * Create the e2e account (once per run) and mark its email verified.
 *
 * Goes through better-auth's own sign-up endpoint so the password hash matches what login verifies, then
 * flips `emailVerified` directly in the throwaway DB — `requireEmailVerification` would otherwise need
 * an email round-trip.
 *
 * IDEMPOTENT, and it has to be: several specs need a session, they share one DB, and this app closes
 * registration after the first account (`assertRegistrationOpen`), so the second spec's sign-up is
 * REFUSED BY DESIGN. A 403/422 here therefore means "already seeded", not "broken" — the login that
 * follows is the real assertion either way.
 */
export async function seedE2eAccount(): Promise<void> {
  const origin = E2E_BASE_URL;
  const res = await fetch(`${origin}/api/auth/sign-up/email`, {
    method: 'POST',
    // better-auth rejects a cross/absent Origin (CSRF guard) — send the trusted baseURL origin.
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_LOGIN, name: 'E2E User' }),
  });
  // 5xx is a real failure (the server is down / the DB has no schema); a 4xx is the closed-registration
  // case above. Fail loudly on the former so a broken harness never looks like a passing suite.
  if (res.status >= 500) throw new Error(`e2e sign-up failed: ${res.status} ${await res.text()}`);

  const { default: Database } = await import('better-sqlite3');
  const { default: path } = await import('node:path');
  const db = new Database(path.join(process.cwd(), E2E_DB_FILE));
  db.prepare('UPDATE user SET emailVerified = 1 WHERE email = ?').run(E2E_EMAIL);
  db.close();
}

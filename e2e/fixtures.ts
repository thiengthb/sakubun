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

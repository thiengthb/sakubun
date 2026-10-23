import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_EMAIL, E2E_PORT } from './e2e/fixtures';

const E2E_DB_URL = `file:${path.join(process.cwd(), E2E_DB_FILE)}`;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false, // one throwaway DB, shared by every spec
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'warmup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['warmup'] },
  ],
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    // Readiness is probed before globalSetup recreates the DB file, so probe a route that never
    // touches the DB: the OAuth provider writes to it the first time auth starts, and a handle on the
    // old file would turn every later write into SQLITE_READONLY_DBMOVED.
    url: `${E2E_BASE_URL}/manifest.webmanifest`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DB_URL,
      BETTER_AUTH_URL: E2E_BASE_URL,
      // Google is the only real way in; e2e uses the dev-only password door (lib/auth/login-policy.ts).
      TEST_PASSWORD_LOGIN: '1',
      ALLOWED_EMAIL: E2E_EMAIL,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? ['e2e', 'secret', '0123456789'].join('-'),
    },
  },
});

import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { E2E_BASE_URL, E2E_DB_FILE, E2E_PORT } from './e2e/fixtures';

// A throwaway DB on a dedicated port: e2e must never touch the real dev/prod data.
// Schema is rebuilt by e2e/global-setup.ts before the run.
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
    // `warmup` chạy trước mọi spec và trả trước chi phí compile lần đầu của dev server — xem
    // e2e/warmup.setup.ts cho lý do đầy đủ (issue #7). `testMatch` phải khai tường minh: mặc định
    // Playwright chỉ nhận `*.spec.ts`/`*.test.ts`, nên `*.setup.ts` sẽ không bị project `chromium`
    // nhặt lên — đúng ý, nó không phải một spec.
    { name: 'warmup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, dependencies: ['warmup'] },
  ],
  webServer: {
    // `dev` (not `start`): no build step, and the specs assert behavior, not bundle output.
    command: `npx next dev -p ${E2E_PORT}`,
    url: E2E_BASE_URL,
    // NEVER reuse a server, not even locally. global-setup DELETES and recreates the throwaway DB file,
    // and better-sqlite3 holds the OLD INODE open: a reused server keeps reading the deleted file, so
    // specs write rows the app cannot see and read rows from a previous run. It fails silently — pages
    // render, logins succeed against the stale user, and assertions pass or fail for reasons that have
    // nothing to do with the code under test. Diagnosed 2026-08-04, after a green mobile-layout run
    // turned out to be measuring a DB from three runs earlier. Booting dev costs ~10s; a gate that
    // reports on the wrong data costs more.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DB_URL,
      BETTER_AUTH_URL: E2E_BASE_URL,
      // Disposable fixture secret for a throwaway DB — not a real credential.
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? ['e2e', 'secret', '0123456789'].join('-'),
    },
  },
});

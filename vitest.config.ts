import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    globals: false,
    // The suites that build a SQLite database from every migration took 5-13 s on a slow CI machine
    // (docs/ci-runner.md), against well under 5 s locally.
    testTimeout: process.env.CI ? 30_000 : 5_000,
  },
});

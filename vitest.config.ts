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
    // The self-hosted CI runner (docs/ci-runner.md) is a laptop under WSL: the suites that build a
    // SQLite database from every migration take 5-13 s there, against well under 5 s locally.
    testTimeout: process.env.CI ? 30_000 : 5_000,
  },
});

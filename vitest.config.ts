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
    // Unit/integration tests only. `e2e/**` is Playwright (`npm run e2e`) and
    // `tooling/fixtures/**` is a harness fixture — neither belongs to vitest.
    include: ['lib/**/*.test.ts'],
    globals: false,
  },
});

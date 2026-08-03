import next from 'eslint-config-next';
import tseslint from 'typescript-eslint';

/**
 * Flat config. The harness layer (.claude/, tooling/, evals/, harness-migrations/)
 * is deliberately out of scope here: it ships with the template and has its own CI
 * (tooling/test-hooks.mjs + .github/workflows/harness-parity.yml).
 */
const config = [
  {
    ignores: [
      '.next/**',
      'lib/generated/**',
      'node_modules/**',
      'tooling/**',
      'evals/**',
      '.claude/**',
      'harness-migrations/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
  ...next,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // React 19: ref is a normal prop. Targets the named import only, so a
      // type-only `import type * as React` stays legal.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "ImportDeclaration[source.value='react'] > ImportSpecifier[imported.name='forwardRef']",
          message: 'React 19: pass ref as a normal prop instead of forwardRef.',
        },
      ],
    },
  },
];

export default config;

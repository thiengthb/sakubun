import next from 'eslint-config-next';
import tseslint from 'typescript-eslint';

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
      'mobile/**',
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

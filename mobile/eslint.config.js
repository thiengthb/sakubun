// The Expo app lints itself, with Expo's rules.
//
// It needs its own config for a boring reason with a sharp edge: ESLint 9 walks UP from the working
// directory, so without a config here it finds the repo root's eslint-config-next setup — which now
// ignores `mobile/**`, leaving every file in this folder silently unlinted. "Silently" is the problem;
// an unlinted directory looks exactly like a clean one.
const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', '.expo/**', 'android/**', 'ios/**', 'dist/**'],
  },
];

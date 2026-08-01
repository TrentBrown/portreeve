import eslint from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '.cache/**',
      '.checkpoints/**',
      'coverage/**',
      'dist/**',
      'node_modules/**',
    ],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      globals: {
        ...globals.bunBuiltin,
        ...globals.es2024,
        ...globals.node,
      },
      sourceType: 'module',
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['error', 'log', 'warn'] }],
    },
  },
  {
    files: ['apps/desktop/renderer/**/*.js'],
    languageOptions: {
      globals: globals.browser,
    },
  },
];

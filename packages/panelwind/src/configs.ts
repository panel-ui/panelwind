/**
 * The two presets.
 *
 * `recommended` errors on what the compiler can prove and warns on what is a
 * matter of policy, so an app that already exists can adopt it without a wall
 * of red on the first run. `strict` is the same set with everything failing.
 *
 * Both configure the parser, because a React Native project's files are TSX
 * and a plugin that assumes an existing parser setup is a plugin that reports
 * nothing on half of them.
 */
import tsParser from '@typescript-eslint/parser';

import { plugin } from './plugin';

const FILES = ['**/*.{js,jsx,ts,tsx,mjs,cjs}'];

const language = {
  parser: tsParser as never,
  ecmaVersion: 2022 as const,
  sourceType: 'module' as const,
  parserOptions: { ecmaFeatures: { jsx: true } },
};

const proven = {
  'panelwind/no-unknown-classes': 'error',
  'panelwind/no-web-only-classes': 'error',
  'panelwind/require-static-classes': 'error',
} as const;

const policy = {
  'panelwind/no-restyle': ['warn', { allow: ['layout'] }],
  'panelwind/no-raw-colors': 'warn',
  'panelwind/no-arbitrary-values': 'warn',
  'panelwind/no-inline-styles': 'warn',
} as const;

const strictPolicy = {
  'panelwind/no-restyle': ['error', { allow: ['layout'] }],
  'panelwind/no-raw-colors': 'error',
  'panelwind/no-arbitrary-values': 'error',
  'panelwind/no-inline-styles': 'error',
} as const;

export const configs = {
  recommended: [
    {
      name: 'panelwind/recommended',
      files: FILES,
      languageOptions: language,
      plugins: { panelwind: plugin },
      rules: { ...proven, ...policy },
    },
  ],
  strict: [
    {
      name: 'panelwind/strict',
      files: FILES,
      languageOptions: language,
      plugins: { panelwind: plugin },
      rules: { ...proven, ...strictPolicy },
    },
  ],
};

/** The harness: real ESLint, real parser, and a file inside the fixture project. */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { afterAll, describe, it } from 'vitest';

import { clearCaches } from '../src/project/fs';
import { resetOracle } from '../src/native/client';
import { clearWarnings } from '../src/project/warn';

RuleTester.describe = describe as unknown as typeof RuleTester.describe;
RuleTester.it = it as unknown as typeof RuleTester.it;

export const fixture = fileURLToPath(new URL('./fixtures/app/', import.meta.url));
/** A screen in the fixture app: the file every case is linted as. */
export const screen = path.join(fixture, 'src', 'app', 'screen.tsx');
export const componentFile = path.join(fixture, 'src', 'components', 'ui', 'button.tsx');

export function tester(settings: Record<string, unknown> = {}) {
  return new RuleTester({
    languageOptions: {
      parser: tsParser as never,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings,
  });
}

/** Caches live for a process; tests build several projects in one. */
export function resetBetweenFiles() {
  afterAll(() => {
    clearCaches();
    clearWarnings();
    resetOracle();
  });
}

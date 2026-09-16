/**
 * The design system's components, and the file each one is defined in.
 *
 * Two places count: the directory a project's own components live in, and the
 * source a design-system package ships. The second matters more than it looks
 * — the npm package carries its `src` so that Tailwind can scan it, and that
 * same source is where a component's variants can be read from, so an error
 * about a `Button` from the package can still say which variants exist.
 */
import * as path from 'node:path';

import { DESIGN_SYSTEM_PACKAGES, projectFor } from './config';
import { isDirectory, memoize, readFile, walk } from './fs';
import { packageDirectory } from './resolve';

export type ComponentIndex = {
  /** Component name to the file that defines it. */
  files: Map<string, string>;
  /** Directories whose files are design-system components. */
  roots: string[];
};

const SOURCE = /\.(tsx|ts|jsx|js)$/;
const DECLARATION = /^\s*export\s+(?:default\s+)?(?:async\s+)?(?:const|let|var|function|class)\s+([A-Z]\w*)/gm;
const NAMED = /^\s*export\s*\{([^}]*)\}/gm;

export function componentsFor(file: string): ComponentIndex {
  const project = projectFor(file);
  const roots: string[] = [];
  if (project.uiDir) roots.push(project.uiDir);
  for (const name of DESIGN_SYSTEM_PACKAGES) {
    const dir = packageDirectory(name, file);
    if (!dir) continue;
    for (const candidate of ['src/components', 'src']) {
      const source = path.join(dir, candidate);
      if (isDirectory(source)) {
        roots.push(source);
        break;
      }
    }
  }

  return memoize(`components:${roots.join('|')}`, () => ({
    roots,
    files: index(roots),
  }));
}

function index(roots: string[]): Map<string, string> {
  const files = new Map<string, string>();
  for (const root of roots) {
    for (const file of walk(root, 3, (candidate) => SOURCE.test(candidate))) {
      for (const name of exportedNames(file)) {
        // The first root wins: a project's own copy of a component is the one
        // it renders, even when the package it came from is also installed.
        if (!files.has(name)) files.set(name, file);
      }
    }
  }
  return files;
}

function exportedNames(file: string): string[] {
  const content = readFile(file);
  if (content === null) return [];
  const names: string[] = [];
  for (const [, name] of content.matchAll(DECLARATION)) {
    if (name) names.push(name);
  }
  for (const [, group] of content.matchAll(NAMED)) {
    for (const entry of (group ?? '').split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      const name = (parts[1] ?? parts[0] ?? '').trim();
      if (/^[A-Z]\w*$/.test(name)) names.push(name);
    }
  }
  return names;
}

/** Whether a resolved file is one of the design system's own. */
export function isComponentFile(file: string, fromFile: string): boolean {
  const { roots } = componentsFor(fromFile);
  return roots.some((root) => !path.relative(root, file).startsWith('..'));
}

/** The file a component name is defined in, when the linter can find one. */
export function componentFileFor(name: string, fromFile: string): string | null {
  return componentsFor(fromFile).files.get(name) ?? null;
}

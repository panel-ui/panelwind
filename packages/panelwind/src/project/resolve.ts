/**
 * Turning an import into a file. Three kinds of specifier reach this: a
 * relative path, an alias from tsconfig `paths` (`@/components/ui/button`,
 * which every Expo template ships), and a package name.
 *
 * Resolution failing is normal and never fatal — an unresolved import means
 * the linter has no file to read, which costs a suggestion, not a verdict.
 */
import { createRequire } from 'node:module';
import * as path from 'node:path';

import { isDirectory, isFile, memoize, nearestFile, readJson } from './fs';

const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.cjs'];

type TsConfig = {
  extends?: string;
  compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> };
};

export function resolveImport(specifier: string, fromFile: string): string | null {
  if (!specifier) return null;
  if (specifier.startsWith('.')) {
    return probe(path.resolve(path.dirname(fromFile), specifier));
  }
  const aliased = throughPaths(specifier, fromFile);
  if (aliased) return aliased;
  return throughPackages(specifier, fromFile);
}

/** A file, or the index of a directory, whichever the specifier named. */
export function probe(candidate: string): string | null {
  if (isFile(candidate)) return candidate;
  for (const extension of SOURCE_EXTENSIONS) {
    const file = `${candidate}${extension}`;
    if (isFile(file)) return file;
  }
  if (isDirectory(candidate)) {
    for (const extension of SOURCE_EXTENSIONS) {
      const file = path.join(candidate, `index${extension}`);
      if (isFile(file)) return file;
    }
  }
  return null;
}

function tsConfigFor(fromFile: string): { file: string; config: TsConfig } | null {
  const file = nearestFile(path.dirname(fromFile), 'tsconfig.json');
  if (!file) return null;
  const config = readJson<TsConfig>(file);
  return config ? { file, config } : null;
}

function throughPaths(specifier: string, fromFile: string): string | null {
  const found = tsConfigFor(fromFile);
  if (!found) return null;
  const { file, config } = found;
  const dir = path.dirname(file);
  const options = config.compilerOptions ?? {};
  const base = path.resolve(dir, options.baseUrl ?? '.');
  const paths = options.paths ?? {};

  for (const [pattern, targets] of Object.entries(paths)) {
    const match = matchPattern(pattern, specifier);
    if (match === null) continue;
    for (const target of targets) {
      const resolved = probe(path.resolve(base, target.replace('*', match)));
      if (resolved) return resolved;
    }
  }

  // Expo's template writes `@/*` into paths, but a project that lost it still
  // means the same thing by it.
  if (specifier.startsWith('@/')) {
    const tail = specifier.slice(2);
    for (const root of [path.join(dir, 'src'), dir]) {
      const resolved = probe(path.join(root, tail));
      if (resolved) return resolved;
    }
  }
  return null;
}

/** `"@/*"` against `"@/components/ui/button"` gives `"components/ui/button"`. */
function matchPattern(pattern: string, specifier: string): string | null {
  const star = pattern.indexOf('*');
  if (star === -1) return pattern === specifier ? '' : null;
  const before = pattern.slice(0, star);
  const after = pattern.slice(star + 1);
  if (!specifier.startsWith(before) || !specifier.endsWith(after)) return null;
  return specifier.slice(before.length, specifier.length - after.length);
}

function throughPackages(specifier: string, fromFile: string): string | null {
  try {
    const require = createRequire(path.join(path.dirname(fromFile), 'noop.js'));
    return require.resolve(specifier);
  } catch {
    return null;
  }
}

/** The directory a package was installed into, or null if it is not installed. */
export function packageDirectory(name: string, fromFile: string): string | null {
  return memoize(`package-dir:${name}:${path.dirname(fromFile)}`, () => {
    try {
      const require = createRequire(path.join(path.dirname(fromFile), 'noop.js'));
      const manifest = require.resolve(`${name}/package.json`);
      return path.dirname(manifest);
    } catch {
      // A package whose exports hide package.json still resolves through its
      // entry point, which is enough to find the directory it lives in.
      const entry = throughPackages(name, fromFile);
      if (!entry) return null;
      let dir = path.dirname(entry);
      for (;;) {
        if (isFile(path.join(dir, 'package.json'))) return dir;
        const parent = path.dirname(dir);
        if (parent === dir) return null;
        dir = parent;
      }
    }
  });
}

type Exports = string | { [key: string]: Exports } | null;

/**
 * Stylesheets resolve differently from modules: `@import "uniwind"` is answered
 * by the package's `style` export condition, which is how a CSS entry reaches a
 * package's Tailwind source at all.
 */
export function resolveStylesheet(specifier: string, fromFile: string): string | null {
  if (specifier.startsWith('.') || path.isAbsolute(specifier)) {
    const candidate = path.resolve(path.dirname(fromFile), specifier);
    if (isFile(candidate)) return candidate;
    return isFile(`${candidate}.css`) ? `${candidate}.css` : null;
  }

  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const subpath = specifier.slice(name.length).replace(/^\//, '');
  const dir = packageDirectory(name, fromFile);
  if (!dir) return null;

  if (subpath) {
    const direct = path.join(dir, subpath);
    if (isFile(direct)) return direct;
    if (isFile(`${direct}.css`)) return `${direct}.css`;
  }

  const manifest = readJson<{ exports?: Exports; style?: string; main?: string }>(
    path.join(dir, 'package.json')
  );
  const key = subpath ? `./${subpath}` : '.';
  const fromExports = styleFromExports(manifest?.exports ?? null, key);
  if (fromExports) {
    const candidate = path.join(dir, fromExports);
    if (isFile(candidate)) return candidate;
  }
  if (!subpath && manifest?.style) {
    const candidate = path.join(dir, manifest.style);
    if (isFile(candidate)) return candidate;
  }
  for (const fallback of ['index.css', `${name.split('/').pop()}.css`]) {
    const candidate = path.join(dir, fallback);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

function styleFromExports(exports: Exports, key: string): string | null {
  if (!exports || typeof exports === 'string') {
    return key === '.' && typeof exports === 'string' ? exports : null;
  }
  const entry = exports[key] ?? (key === '.' ? exports : null);
  if (!entry) return null;
  if (typeof entry === 'string') return entry.endsWith('.css') ? entry : null;
  for (const condition of ['style', 'default', 'import', 'require']) {
    const value = entry[condition];
    if (typeof value === 'string' && value.endsWith('.css')) return value;
  }
  return null;
}

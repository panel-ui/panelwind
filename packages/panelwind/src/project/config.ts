/**
 * Where a project keeps its components and its theme.
 *
 * A project that uses the PanelUI CLI already answers this in `panelui.json`:
 * it names the CSS entry, the theme file and the directory copied components
 * are written to. Everything else is discovery, and discovery is allowed to
 * come back empty — a rule that needs the theme says so in its own warning
 * rather than guessing.
 */
import * as path from 'node:path';

import { isDirectory, isFile, memoize, nearestFile, readFile, readJson, walk } from './fs';
import { warnOnce } from './warn';

export type ProjectConfig = {
  /** The directory `panelui.json` or the nearest `package.json` sits in. */
  root: string;
  configFile: string | null;
  /** The stylesheet the bundler compiles: the one that imports Tailwind and Uniwind. */
  cssEntry: string | null;
  /** Where the tokens are declared. Often the entry itself. */
  themeFile: string | null;
  /** The directory copied components live in, when there is one. */
  uiDir: string | null;
  /** Import prefixes that name a design-system component, such as `@/components/ui`. */
  uiAliases: string[];
};

type PanelUiJson = {
  aliases?: { components?: string; lib?: string; hooks?: string };
  css?: string;
  theme?: string;
};

const CONFIG_FILE = 'panelui.json';

/** Packages whose components are design-system components wherever they are imported. */
export const DESIGN_SYSTEM_PACKAGES = ['panelui-native'];

const UI_DIRECTORIES = ['components/ui', 'src/components/ui', 'src/components', 'components'];

export function projectFor(file: string): ProjectConfig {
  const dir = path.dirname(file);
  const configFile = nearestFile(dir, CONFIG_FILE);
  const packageJson = nearestFile(dir, 'package.json');
  const root = configFile
    ? path.dirname(configFile)
    : packageJson
      ? path.dirname(packageJson)
      : dir;

  return memoize(`project:${root}:${configFile ?? ''}`, () => build(root, configFile));
}

function build(root: string, configFile: string | null): ProjectConfig {
  const config = configFile ? readJson<PanelUiJson>(configFile) : null;
  if (configFile && !config) {
    warnOnce(`config:${configFile}`, `${configFile} is not valid JSON; it is being ignored.`);
  }

  const uiAliases = aliasesOf(config);
  const uiDir = uiDirectoryOf(root, uiAliases);
  const cssEntry = entryOf(root, config?.css);
  const themeFile = config?.theme ? existing(root, config.theme) ?? cssEntry : cssEntry;

  return { root, configFile, cssEntry, themeFile, uiDir, uiAliases };
}

function aliasesOf(config: PanelUiJson | null) {
  const declared = config?.aliases?.components;
  const aliases = new Set<string>(['@/components/ui']);
  if (declared) aliases.add(declared.replace(/\/+$/, ''));
  return [...aliases];
}

/**
 * An alias such as `@/components/ui` is a path once `@/` is read as the
 * project's source root — `src` when there is one, the root otherwise. That is
 * the convention every Expo template ships with, and tsconfig `paths` is
 * consulted separately when an import is actually resolved.
 */
function uiDirectoryOf(root: string, aliases: string[]): string | null {
  for (const alias of aliases) {
    const tail = alias.replace(/^@\//, '');
    for (const base of [path.join(root, 'src'), root]) {
      const candidate = path.join(base, tail);
      if (isDirectory(candidate)) return candidate;
    }
  }
  for (const relative of UI_DIRECTORIES) {
    const candidate = path.join(root, relative);
    if (isDirectory(candidate)) return candidate;
  }
  return null;
}

function existing(root: string, relative: string): string | null {
  const candidate = path.isAbsolute(relative) ? relative : path.join(root, relative);
  return isFile(candidate) ? candidate : null;
}

/**
 * The CSS entry, named or found. A file that only declares tokens is not the
 * entry — the entry is the stylesheet that pulls Tailwind in, because that is
 * the one a compiler can be pointed at.
 */
function entryOf(root: string, named: string | undefined): string | null {
  if (named) {
    const file = existing(root, named);
    if (file) return file;
    warnOnce(
      `css:${root}:${named}`,
      `panelui.json names a CSS entry that does not exist (${named}); looking for one instead.`
    );
  }

  type Candidate = { file: string; tokens: number; depth: number };
  const entries: Candidate[] = walk(root, 3, (file: string) => file.endsWith('.css'))
    .map((file: string) => ({ file, content: readFile(file) ?? '' }))
    .filter((entry) => /@import\s+['"]tailwindcss/.test(entry.content))
    .map((entry) => ({
      file: entry.file,
      tokens: (entry.content.match(/--color-[\w-]+\s*:/g) ?? []).length,
      depth: path.relative(root, entry.file).split(path.sep).length,
    }))
    .sort(
      (a: Candidate, b: Candidate) =>
        b.tokens - a.tokens || a.depth - b.depth || a.file.localeCompare(b.file)
    );

  return entries[0]?.file ?? null;
}

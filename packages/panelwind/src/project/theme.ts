/**
 * The tokens a project has declared, read from its own CSS.
 *
 * Two shapes are read, because native design systems write both. The web
 * shape declares a token and points it at a variable — `--color-primary:
 * var(--primary)` — with the value in `:root`. The native shape declares the
 * name in `@theme` and gives every theme its own value in a `@variant` block,
 * because React Native cannot evaluate `color-mix()` at runtime and the values
 * have to be precomputed per theme.
 *
 * Tailwind's own stylesheet is followed for imports but never contributes
 * tokens: `bg-red-500` is a palette colour, not something this project chose.
 */
import * as path from 'node:path';

import { projectFor } from './config';
import { memoize, modifiedAt, readFile } from './fs';
import { resolveStylesheet } from './resolve';

export type Theme = {
  file: string | null;
  /** Every stylesheet that contributed, so a cache can tell when to rebuild. */
  files: string[];
  /** Declared colour tokens, without the `--color-` prefix: `primary`, `card-foreground`. */
  colors: Set<string>;
  /** A token's value in the default theme, for nearest-colour suggestions. */
  colorValues: Map<string, string>;
  /** `radius`, `text`, `spacing` and the rest, as scale name to steps. */
  scales: Map<string, Map<string, string>>;
  /** Utilities the project declared with `@utility`. */
  utilities: Set<string>;
};

type Block = {
  prelude: string;
  declarations: [string, string][];
  children: Block[];
};

const EMPTY: Theme = {
  file: null,
  files: [],
  colors: new Set(),
  colorValues: new Map(),
  scales: new Map(),
  utilities: new Set(),
};

const TAILWIND_PACKAGE = `${path.sep}node_modules${path.sep}tailwindcss${path.sep}`;
const MAX_DEPTH = 8;

export function themeFor(file: string): Theme {
  const project = projectFor(file);
  const entry = project.themeFile ?? project.cssEntry;
  if (!entry) return EMPTY;
  const stamp = modifiedAt(entry) ?? 0;
  return memoize(`theme:${entry}:${stamp}`, () => read(entry));
}

/** Every file the theme is built from, newest modification first — a cache key. */
export function themeSignature(theme: Theme): string {
  return theme.files.map((file) => `${file}:${modifiedAt(file) ?? 0}`).join('|');
}

function read(entry: string): Theme {
  const theme: Theme = {
    file: entry,
    files: [],
    colors: new Set(),
    colorValues: new Map(),
    scales: new Map(),
    utilities: new Set(),
  };
  /** Custom properties as declared, so `var(--primary)` can be followed. */
  const variables = new Map<string, string>();
  const seen = new Set<string>();

  const visit = (cssFile: string, depth: number) => {
    if (depth > MAX_DEPTH || seen.has(cssFile)) return;
    seen.add(cssFile);
    const content = readFile(cssFile);
    if (content === null) return;
    const source = stripComments(content);
    const own = !cssFile.includes(TAILWIND_PACKAGE);
    if (own) theme.files.push(cssFile);

    for (const specifier of importsOf(source)) {
      const resolved = resolveStylesheet(specifier, cssFile);
      if (resolved) visit(resolved, depth + 1);
    }

    for (const block of parse(source).children) {
      collect(block, theme, variables, own);
    }
  };

  visit(entry, 0);

  for (const [name, raw] of variables) {
    if (!name.startsWith('--color-')) continue;
    const token = name.slice('--color-'.length);
    if (!theme.colors.has(token)) continue;
    const value = resolveValue(raw, variables);
    if (value && isColor(value)) theme.colorValues.set(token, value);
  }

  return theme;
}

function collect(
  block: Block,
  theme: Theme,
  variables: Map<string, string>,
  own: boolean
) {
  const prelude = block.prelude.trim();

  if (prelude.startsWith('@utility')) {
    const name = prelude.replace('@utility', '').trim().replace(/\*$/, '');
    if (own && name) theme.utilities.add(name);
    return;
  }

  const isTheme = prelude.startsWith('@theme');
  const isRoot = /(^|[\s,])(:root|html|body)\b/.test(prelude) || prelude.startsWith('@variant');

  for (const [name, value] of block.declarations) {
    if (!name.startsWith('--')) continue;
    if (isTheme && name.startsWith('--color-') && own) {
      theme.colors.add(name.slice('--color-'.length));
    }
    if (isTheme && own) recordScale(theme, name, value);
    // A later declaration wins, which is what the cascade does too. Theme
    // blocks declare the name; `:root` and its variants carry the value.
    if (value !== 'unset' && (isTheme || isRoot)) variables.set(name, value);
  }

  for (const child of block.children) {
    // A dark block describes the same tokens in the other theme; suggestions
    // are made in one of them, and the first one wins.
    if (/dark/.test(child.prelude) && !/light/.test(child.prelude)) continue;
    collect(child, theme, variables, own);
  }
}

const SCALES = ['radius', 'text', 'spacing', 'font', 'shadow', 'blur', 'leading', 'tracking'];

function recordScale(theme: Theme, name: string, value: string) {
  for (const scale of SCALES) {
    const prefix = `--${scale}-`;
    if (name === `--${scale}`) {
      steps(theme, scale).set('DEFAULT', value);
      return;
    }
    if (name.startsWith(prefix)) {
      steps(theme, scale).set(name.slice(prefix.length), value);
      return;
    }
  }
}

function steps(theme: Theme, scale: string) {
  let map = theme.scales.get(scale);
  if (!map) {
    map = new Map();
    theme.scales.set(scale, map);
  }
  return map;
}

const VAR = /var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/;

function resolveValue(value: string, variables: Map<string, string>, depth = 0): string {
  if (depth > 4) return value;
  const match = value.match(VAR);
  if (!match) return value.trim();
  const referenced = variables.get(match[1]!);
  const replacement = referenced ?? match[2]?.trim() ?? '';
  if (!replacement) return value.trim();
  return resolveValue(value.replace(match[0], replacement), variables, depth + 1);
}

function isColor(value: string) {
  return /^(#|rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color\()/i.test(value.trim());
}

function importsOf(css: string): string[] {
  const found: string[] = [];
  for (const [, specifier] of css.matchAll(/@import\s+['"]([^'"]+)['"]/g)) {
    if (specifier) found.push(specifier.replace(/\s+(layer|supports|source)\(.*$/, '').trim());
  }
  return found;
}

function stripComments(css: string) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** A CSS block tree. Enough of a parser for declarations and nesting, and no more. */
function parse(css: string): Block {
  const root: Block = { prelude: '', declarations: [], children: [] };
  const stack: Block[] = [root];
  let buffer = '';

  for (let i = 0; i < css.length; i++) {
    const character = css[i];
    if (character === '{') {
      const block: Block = { prelude: buffer.trim(), declarations: [], children: [] };
      stack[stack.length - 1]!.children.push(block);
      stack.push(block);
      buffer = '';
    } else if (character === '}') {
      addDeclaration(stack[stack.length - 1]!, buffer);
      buffer = '';
      if (stack.length > 1) stack.pop();
    } else if (character === ';') {
      addDeclaration(stack[stack.length - 1]!, buffer);
      buffer = '';
    } else {
      buffer += character;
    }
  }
  return root;
}

function addDeclaration(block: Block, text: string) {
  const trimmed = text.trim();
  if (!trimmed || trimmed.startsWith('@')) return;
  const colon = trimmed.indexOf(':');
  if (colon === -1) return;
  const name = trimmed.slice(0, colon).trim();
  const value = trimmed.slice(colon + 1).trim();
  if (name) block.declarations.push([name, value]);
}

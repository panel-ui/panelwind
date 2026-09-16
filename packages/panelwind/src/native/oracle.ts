/**
 * Asks the project's own Tailwind what a class compiles to.
 *
 * It has to be the project's own, and it has to be the project's own CSS
 * entry: `ios:flex` is not a Tailwind class, it is a variant Uniwind declares
 * in the stylesheet it ships, and a linter compiling against a stock Tailwind
 * would report every one of them as a typo. Loading the entry brings in the
 * variants, the safe-area utilities, the theme and anything the project added.
 *
 * Everything here is async and knows nothing about threads; worker.ts runs it
 * and client.ts is the synchronous face a rule can call.
 */
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { modifiedAt, readFile } from '../project/fs';
import { resolveStylesheet } from '../project/resolve';

type DesignSystem = {
  candidatesToCss(candidates: string[]): (string | null)[];
  getClassList(): (string | [string, unknown])[];
};

type Tailwind = {
  __unstable__loadDesignSystem(
    css: string,
    options: {
      base: string;
      loadStylesheet(id: string, base: string): Promise<{ base: string; content: string }>;
      loadModule(
        id: string,
        base: string,
        hint: string
      ): Promise<{ base: string; module: unknown }>;
    }
  ): Promise<DesignSystem>;
};

export type Request = { entry: string; tokens: string[] };

export type Reply =
  | { ok: true; css: (string | null)[]; classes: string[] }
  | { ok: false; reason: string };

type Loaded = { system: DesignSystem; signature: string; classes: string[] };

const systems = new Map<string, Loaded>();

export async function answer(request: Request): Promise<Reply> {
  try {
    const loaded = await load(request.entry);
    if (!loaded) {
      return { ok: false, reason: `Tailwind could not be loaded from ${request.entry}` };
    }
    return {
      ok: true,
      css: loaded.system.candidatesToCss(request.tokens),
      classes: loaded.classes,
    };
  } catch (error) {
    return { ok: false, reason: (error as Error).message };
  }
}

async function load(entry: string): Promise<Loaded | null> {
  const content = readFile(entry);
  if (content === null) return null;

  const stylesheets: string[] = [entry];
  const cached = systems.get(entry);
  if (cached && cached.signature === signatureOf(cached, entry)) return cached;

  const tailwind = await loadTailwind(path.dirname(entry));
  if (!tailwind) return null;

  const system = await tailwind.__unstable__loadDesignSystem(content, {
    base: path.dirname(entry),
    async loadStylesheet(id: string, base: string) {
      const resolved = resolveStylesheet(id, path.join(base, 'entry.css'));
      if (!resolved) throw new Error(`cannot resolve the stylesheet ${id} from ${base}`);
      stylesheets.push(resolved);
      return { base: path.dirname(resolved), content: readFile(resolved) ?? '' };
    },
    async loadModule(id: string, base: string) {
      const require = createRequire(path.join(base, 'noop.js'));
      const resolved = require.resolve(id);
      const module = await import(pathToFileURL(resolved).href);
      return { base: path.dirname(resolved), module: module.default ?? module };
    },
  });

  const classes = system
    .getClassList()
    .map((entryOrName) => (Array.isArray(entryOrName) ? entryOrName[0] : entryOrName));

  const loaded: Loaded = { system, classes, signature: '' };
  loaded.signature = stylesheets.map((file) => `${file}:${modifiedAt(file) ?? 0}`).join('|');
  systems.set(entry, loaded);
  return loaded;
}

/** The files this system was built from, as they are now. */
function signatureOf(loaded: Loaded, entry: string): string {
  return loaded.signature
    .split('|')
    .map((part) => {
      const file = part.slice(0, part.lastIndexOf(':')) || entry;
      return `${file}:${modifiedAt(file) ?? 0}`;
    })
    .join('|');
}

async function loadTailwind(from: string): Promise<Tailwind | null> {
  for (const base of [from, process.cwd()]) {
    let resolved: string;
    try {
      resolved = createRequire(path.join(base, 'noop.js')).resolve('tailwindcss');
    } catch {
      continue;
    }
    const module = (await import(pathToFileURL(resolved).href)) as Partial<Tailwind> & {
      default?: Partial<Tailwind>;
    };
    if (typeof module.__unstable__loadDesignSystem === 'function') return module as Tailwind;
    if (typeof module.default?.__unstable__loadDesignSystem === 'function') {
      return module.default as Tailwind;
    }
    throw new Error(`${resolved} is not Tailwind v4`);
  }
  return null;
}

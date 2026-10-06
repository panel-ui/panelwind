/**
 * Parsing for files the linter reads on its own — a component's source, to
 * find its variants, or a barrel, to find where a name comes from. The file
 * being linted is already parsed by the host; this is for everything else.
 *
 * The parser is oxc-parser when it is installed: it needs no TypeScript
 * compiler, so it also reads a project whose compiler is TypeScript 7, which
 * @typescript-eslint/parser refuses to load. @typescript-eslint/parser
 * otherwise. Both are loaded on first use, so neither costs anything to a run
 * that never reads a component.
 */
import { createRequire } from 'node:module';

import { memoize, modifiedAt, readFile } from './fs';
import { warnOnce } from './warn';

export type Ast = any;

type Parse = (code: string, filePath?: string) => Ast | null;

const requireParser = createRequire(import.meta.url);

let secondary: Parse | null | undefined;

function loadParser(): Parse | null {
  if (secondary !== undefined) return secondary;
  try {
    const oxc = requireParser('oxc-parser');
    secondary = (code, filePath) => {
      const result = oxc.parseSync(filePath ?? 'source.tsx', code, {
        sourceType: 'module',
        preserveParens: false,
      });
      return result.errors.some((error: { severity: string }) => error.severity === 'Error')
        ? null
        : result.program;
    };
    return secondary;
  } catch {
    // Not installed: the fallback below.
  }
  try {
    const { parse } = requireParser('@typescript-eslint/parser');
    secondary = (code, filePath) =>
      parse(code, {
        jsx: true,
        loc: true,
        range: true,
        comment: false,
        errorOnUnknownASTType: false,
        filePath,
      });
    return secondary;
  } catch {
    // Not installed either: said once, below.
  }
  warnOnce(
    'parser:none',
    'neither oxc-parser nor @typescript-eslint/parser is installed, so component files cannot be read: variants and wrappers stay unknown until one is.',
  );
  secondary = null;
  return secondary;
}

export function parseSource(code: string, filePath?: string): Ast | null {
  const parse = loadParser();
  if (!parse) return null;
  try {
    return parse(code, filePath);
  } catch {
    return null;
  }
}

/** The parsed form of a file on disk, reparsed when the file changes. */
export function astFor(file: string): Ast | null {
  const mtimeMs = modifiedAt(file);
  if (mtimeMs === null) return null;
  return memoize(`ast:${file}:${mtimeMs}`, () => {
    const code = readFile(file);
    return code === null ? null : parseSource(code, file);
  });
}

/** Walks every node of an AST, children first or last is not something callers depend on. */
export function walkAst(node: Ast, visit: (node: Ast) => void) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walkAst(child, visit);
    return;
  }
  if (typeof node.type === 'string') visit(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const child = (node as Record<string, unknown>)[key];
    if (child && typeof child === 'object') walkAst(child, visit);
  }
}

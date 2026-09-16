/**
 * Parsing for files the linter reads on its own — a component's source, to
 * find its variants, or a barrel, to find where a name comes from. The file
 * being linted is already parsed by ESLint; this is for everything else.
 */
import { parse } from '@typescript-eslint/parser';

import { memoize, modifiedAt, readFile } from './fs';

export type Ast = any;

export function parseSource(code: string, filePath?: string): Ast | null {
  try {
    return parse(code, {
      jsx: true,
      loc: true,
      range: true,
      comment: false,
      errorOnUnknownASTType: false,
      filePath,
    });
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

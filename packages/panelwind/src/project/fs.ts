/**
 * Every read the linter makes goes through here, so that a project is read
 * once per lint run rather than once per file, and so that an editor session
 * notices an edit: content is cached against the file's modification time,
 * not against its path alone.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const memos = new Map<string, unknown>();

/** A value computed once for a key, for derived work that has no file of its own. */
export function memoize<T>(key: string, compute: () => T): T {
  if (memos.has(key)) return memos.get(key) as T;
  const value = compute();
  memos.set(key, value);
  return value;
}

type Cached = { mtimeMs: number; content: string | null };

const files = new Map<string, Cached>();

export function modifiedAt(file: string): number | null {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

export function readFile(file: string): string | null {
  const mtimeMs = modifiedAt(file);
  if (mtimeMs === null) return null;
  const cached = files.get(file);
  if (cached && cached.mtimeMs === mtimeMs) return cached.content;
  let content: string | null;
  try {
    content = fs.readFileSync(file, 'utf8');
  } catch {
    content = null;
  }
  files.set(file, { mtimeMs, content });
  return content;
}

export function readJson<T>(file: string): T | null {
  const content = readFile(file);
  if (content === null) return null;
  try {
    return JSON.parse(stripJsonComments(content)) as T;
  } catch {
    return null;
  }
}

/** tsconfig.json is JSON with comments and trailing commas often enough to matter. */
function stripJsonComments(text: string) {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (c === '\n') {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === '*' && next === '/') {
        inBlock = false;
        i++;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i++;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === '/' && next === '/') {
      inLine = true;
      i++;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlock = true;
      i++;
      continue;
    }
    out += c;
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

export function isFile(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

export function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

export function readDirectory(dir: string): string[] {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

/**
 * The nearest `name` at or above `from`, stopping at the filesystem root and
 * never climbing out through a `node_modules` directory — a file inside a
 * dependency belongs to that dependency, not to the app that installed it.
 */
export function nearestFile(from: string, name: string): string | null {
  let dir = isDirectory(from) ? from : path.dirname(from);
  for (;;) {
    const candidate = path.join(dir, name);
    if (isFile(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Files under `dir`, depth-limited, skipping the directories nobody means to lint. */
const SKIP = new Set(['node_modules', '.git', '.expo', 'dist', 'build', 'ios', 'android']);

export function walk(dir: string, depth: number, match: (file: string) => boolean): string[] {
  if (depth < 0 || !isDirectory(dir)) return [];
  const found: string[] = [];
  for (const entry of readDirectory(dir)) {
    if (SKIP.has(entry) || entry.startsWith('.')) continue;
    const full = path.join(dir, entry);
    if (isDirectory(full)) {
      found.push(...walk(full, depth - 1, match));
    } else if (match(full)) {
      found.push(full);
    }
  }
  return found;
}

/** Tests build several projects in one process; nothing else should need this. */
export function clearCaches() {
  memos.clear();
  files.clear();
}

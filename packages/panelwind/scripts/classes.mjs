/**
 * Every class a real project uses, and how the classifier reads each one.
 *
 * The list to look at is the unclassified one. A class the grammar does not
 * recognise is refused by no-restyle with the wrong reason — "fix the
 * spelling" for a class that is spelled correctly — so a hole here is a false
 * positive there. `flex-1` and `flex-row`, the two most used classes in any
 * React Native codebase, were once in that list.
 *
 *   node scripts/classes.mjs ../../some-expo-app/src
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const target = process.argv[2];
if (!target) {
  console.error('usage: node scripts/classes.mjs <directory>');
  process.exit(1);
}
const root = path.resolve(target);

const { grammar, project } = await import(
  pathToFileURL(path.join(import.meta.dirname, '..', 'dist', 'index.js')).href
);

const SKIP = new Set(['node_modules', '.expo', 'ios', 'android', '.git', 'dist']);

function walk(directory, depth, found = []) {
  if (depth < 0) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, depth - 1, found);
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const uses = new Map();
for (const file of walk(root, 8)) {
  const code = fs.readFileSync(file, 'utf8');
  for (const [, value] of code.matchAll(/className\s*=\s*["'`]([^"'`]+)["'`]/g)) {
    for (const token of value.split(/\s+/).filter(Boolean)) {
      if (/[${}]/.test(token)) continue;
      uses.set(token, (uses.get(token) ?? 0) + 1);
    }
  }
}

const first = walk(root, 8)[0] ?? path.join(root, 'index.tsx');
const theme = project.themeFor(first);
const vocabulary = {
  colors: theme.colors,
  textSizes: new Set(theme.scales.get('text')?.keys() ?? []),
};

const byCategory = new Map();
for (const [token, count] of uses) {
  const category = grammar.classify(token, vocabulary);
  byCategory.set(category, [...(byCategory.get(category) ?? []), [token, count]]);
}

console.log(`${uses.size} distinct classes; the theme declares ${theme.colors.size} colours\n`);
for (const [category, list] of [...byCategory].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(list.length).padStart(5)}  ${category}`);
}

const unclassified = (byCategory.get('unclassified') ?? []).sort((a, b) => b[1] - a[1]);
if (!unclassified.length) {
  console.log('\nnothing unclassified.');
} else {
  console.log('\nunclassified, most used first:');
  for (const [token, count] of unclassified) console.log(`  ${String(count).padStart(4)} ${token}`);
}

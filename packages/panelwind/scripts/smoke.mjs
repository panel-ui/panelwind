/**
 * Runs the plugin over a real project and summarises what it found, by rule,
 * with a few examples of each.
 *
 * This is how a change is checked against a codebase nobody wrote for the
 * linter: the tests say the rules work on the cases they were given, and this
 * says whether they are quiet on a project that was already correct. Reading
 * the output is the point — a rule that fires hundreds of times on good code
 * is wrong even when every finding is defensible.
 *
 * Read-only; nothing in the target project is written.
 *
 *   node scripts/smoke.mjs ../../some-expo-app/src [file limit]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { Linter } from 'eslint';

const [target, limitArgument] = process.argv.slice(2);
if (!target) {
  console.error('usage: node scripts/smoke.mjs <directory> [file limit]');
  process.exit(1);
}
const limit = Number(limitArgument ?? 40);
const root = path.resolve(target);

const { configs } = await import(
  pathToFileURL(path.join(import.meta.dirname, '..', 'dist', 'index.js')).href
);

const SKIP = new Set(['node_modules', '.expo', 'ios', 'android', '.git', 'dist']);

function walk(directory, depth, found = []) {
  if (depth < 0) return found;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full, depth - 1, found);
    else if (entry.name.endsWith('.tsx')) found.push(full);
  }
  return found;
}

const files = walk(root, 8).slice(0, limit);
const linter = new Linter({ configType: 'flat' });
const counts = new Map();
const samples = new Map();
let total = 0;

for (const file of files) {
  let messages;
  try {
    messages = linter.verify(fs.readFileSync(file, 'utf8'), configs.strict, file);
  } catch (error) {
    console.error(`! ${path.relative(root, file)}: ${error.message}`);
    continue;
  }
  for (const message of messages) {
    const rule = message.ruleId ?? 'parse';
    counts.set(rule, (counts.get(rule) ?? 0) + 1);
    total++;
    const shown = samples.get(rule) ?? [];
    if (shown.length < 4) {
      shown.push(`${path.relative(root, file)}:${message.line} ${message.message}`);
      samples.set(rule, shown);
    }
  }
}

console.log(`\n${files.length} files, ${total} findings\n`);
for (const [rule, count] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`${String(count).padStart(5)}  ${rule}`);
  for (const sample of samples.get(rule) ?? []) console.log(`       ${sample}`);
}

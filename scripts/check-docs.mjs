/**
 * Checks the documentation still describes the rules that exist.
 *
 * Docs that have drifted are worse than no docs, because they are trusted. This
 * runs in CI so a rule cannot be added, renamed or removed without its page,
 * its row in the two tables, and the link its own metadata points at.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const distribution = path.join(root, 'packages', 'panelwind', 'dist', 'index.js');

if (!fs.existsSync(distribution)) {
  console.error('check-docs: build the package first (npm run build).');
  process.exit(1);
}

const { rules } = await import(pathToFileURL(distribution).href);
const names = Object.keys(rules).sort();
const problems = [];

function read(file) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

const readme = read('README.md') ?? '';
const index = read('docs/README.md') ?? '';

for (const name of names) {
  const page = `docs/rules/${name}.md`;
  const contents = read(page);
  if (contents === null) {
    problems.push(`${name}: ${page} is missing`);
    continue;
  }
  if (!contents.startsWith(`# ${name}\n`)) {
    problems.push(`${name}: ${page} does not start with "# ${name}"`);
  }
  if (!index.includes(`(./rules/${name}.md)`)) {
    problems.push(`${name}: docs/README.md has no row for it`);
  }
  if (!readme.includes(`docs/rules/${name}.md`)) {
    problems.push(`${name}: README.md has no row for it`);
  }
  const url = rules[name].meta?.docs?.url ?? '';
  if (!url.endsWith(`docs/rules/${name}.md`)) {
    problems.push(`${name}: meta.docs.url points at ${url || 'nothing'}`);
  }
  if (!rules[name].meta?.docs?.description) {
    problems.push(`${name}: meta.docs.description is empty`);
  }
}

/** A page for a rule that no longer exists is a page nobody will delete. */
for (const file of fs.readdirSync(path.join(root, 'docs', 'rules'))) {
  const name = file.replace(/\.md$/, '');
  if (!names.includes(name)) problems.push(`${file}: there is no rule called ${name}`);
}

if (problems.length) {
  console.error('check-docs: the documentation and the rules disagree.\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`check-docs: ${names.length} rules, each with a page, two rows and a link.`);

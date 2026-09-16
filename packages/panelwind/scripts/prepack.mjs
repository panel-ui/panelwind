/**
 * Puts the README and the licence inside the package before it is packed.
 *
 * Both live at the repository root, and npm only packs what is inside the
 * package directory — without this the published page is blank and the tarball
 * carries no licence. The copy also rewrites the README's relative links to
 * point at the repository, because a link to ./docs/ resolves against the
 * package directory on npm, where there is no docs folder.
 *
 * `postpack` deletes the copies again, so they never appear in git.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const here = import.meta.dirname;
const packageDirectory = path.join(here, '..');
const root = path.join(packageDirectory, '..', '..');
const repository = 'https://github.com/panel-ui/panelwind/blob/main';

const readme = fs
  .readFileSync(path.join(root, 'README.md'), 'utf8')
  .replaceAll('](./', `](${repository}/`)
  .replaceAll('href="./', `href="${repository}/`);

fs.writeFileSync(path.join(packageDirectory, 'README.md'), readme);
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(packageDirectory, 'LICENSE'));

console.log('prepack: README.md and LICENSE copied into the package.');

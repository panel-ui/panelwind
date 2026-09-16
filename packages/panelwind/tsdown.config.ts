import { defineConfig } from 'tsdown';

const shared = {
  format: 'esm' as const,
  platform: 'node' as const,
  target: 'node20.19',
  sourcemap: false,
  // Entry names are what package.json points at; a hashed chunk name is not.
  hash: false,
};

/**
 * Two builds rather than two entries in one, so the plugin's types land at
 * dist/index.d.ts under that name — with both in one build the declaration
 * files are chunked and hashed, and package.json cannot point at a hash.
 *
 * The worker is a build of its own for a second reason: `new Worker()` needs a
 * file on disk to load, so it has to stay unbundled into the plugin.
 */
export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    dts: true,
    clean: true,
  },
  {
    ...shared,
    entry: { 'native-worker': 'src/native/worker.ts' },
    dts: false,
    clean: false,
  },
]);

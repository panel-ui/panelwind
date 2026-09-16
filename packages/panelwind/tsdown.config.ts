import { defineConfig } from 'tsdown';

/**
 * Two entries, because the oracle's worker has to be a file on disk that
 * `new Worker(...)` can load: bundling it into the plugin would leave nothing
 * to point at. `native-worker` keeps its name so `client.ts` can find it next
 * to itself in `dist`.
 */
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'native-worker': 'src/native/worker.ts',
  },
  format: 'esm',
  platform: 'node',
  target: 'node20.19',
  dts: true,
  clean: true,
  sourcemap: false,
});

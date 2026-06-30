import { defineConfig } from 'tsup';
import { resolve } from 'path';

const engineAlias = { 'remura-engine': resolve(__dirname, '../remura-engine/src/index.ts') };

export default defineConfig([
  {
    // Content script + background service worker
    entry: {
      content: 'src/content.ts',
      background: 'src/background.ts',
    },
    outDir: 'dist',
    format: ['esm'],
    target: 'chrome112',
    bundle: true,
    splitting: false,
    sourcemap: false,
    esbuildOptions(opts) {
      opts.alias = engineAlias;
    },
  },
  {
    // Popup script — outputs to popup/ alongside popup.html
    entry: { popup: 'src/popup/popup.ts' },
    outDir: 'popup',
    format: ['esm'],
    target: 'chrome112',
    bundle: true,
    splitting: false,
    sourcemap: false,
    esbuildOptions(opts) {
      opts.alias = engineAlias;
    },
  },
]);

/**
 * Build script for the Remora Chrome extension.
 *
 * Uses the tsup Node.js API directly so it works on NTFS filesystems
 * where native binaries cannot be executed. Run with:
 *
 *   node build-dev.js
 *
 * Output:
 *   dist/content.js    — content script
 *   dist/background.js — MV3 service worker
 *   popup/popup.js     — popup panel script
 */

import { build } from 'tsup';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve the engine source — works both in the repo and when copied to /tmp.
const engineSrc = resolve(__dirname, '../remora-engine/src/index.ts');
const alias = { 'remora-engine': engineSrc };

const shared = {
  format: ['esm'],
  target: 'chrome112',
  bundle: true,
  splitting: false,
  sourcemap: false,
  outExtension: () => ({ js: '.js' }),   // Chrome extensions expect .js, not .mjs
  esbuildOptions(opts) { opts.alias = alias; },
};

await build({
  ...shared,
  entry: {
    content:    resolve(__dirname, 'src/content.ts'),
    background: resolve(__dirname, 'src/background.ts'),
  },
  outDir: resolve(__dirname, 'dist'),
});

await build({
  ...shared,
  entry: { popup: resolve(__dirname, 'src/popup/popup.ts') },
  outDir: resolve(__dirname, 'popup'),
});

console.log('\n✓ Extension built. Load the unpacked extension from this directory in Chrome.');

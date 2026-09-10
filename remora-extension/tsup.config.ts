import { defineConfig } from 'tsup';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

const engineAlias = { 'remora-engine': resolve(__dirname, '../remora-engine/src/index.ts') };

// Minimal .env loader — avoids an extra dependency for a single key.
// .env is gitignored; see .env.example for the expected shape.
function loadEnvKey(name: string): string {
  const envPath = resolve(__dirname, '.env');
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, 'utf8').match(new RegExp(`^${name}=(.*)$`, 'm'));
    if (match?.[1]) return match[1].trim();
  }
  return process.env[name] ?? '';
}

const safeBrowsingDefine = {
  __SAFE_BROWSING_API_KEY__: JSON.stringify(loadEnvKey('SAFE_BROWSING_API_KEY')),
};

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
      opts.define = { ...opts.define, ...safeBrowsingDefine };
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

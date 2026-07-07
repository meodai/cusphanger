import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The demo app lives entirely in src/demo (index.html included), so the dev
// server and demo build root there; tests are discovered from src/ as before.
const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: 'src/demo',
  base: './', // the demo deploys under /cusphanger/ on GitHub Pages
  publicDir: `${here}public`,
  build: { outDir: `${here}dist-demo`, emptyOutDir: true },
  test: {
    globals: true,
    environment: 'node',
    dir: `${here}src`,
    include: ['**/*.test.ts'],
  },
});

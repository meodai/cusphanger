import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './', // the demo deploys under /cusphanger/ on GitHub Pages
  build: { outDir: 'dist-demo' },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { outDir: 'dist-demo' },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

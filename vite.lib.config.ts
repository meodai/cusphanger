import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [dts({ include: ['src/lib'], rollupTypes: true })],
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/lib/index.ts'),
      name: 'CuspHanger',
      fileName: 'cusphanger',
    },
    rollupOptions: {
      external: ['culori'],
      output: { globals: { culori: 'culori' } },
    },
  },
});

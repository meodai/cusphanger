import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [dts({ include: ['src/lib'], rollupTypes: true })],
  build: {
    outDir: 'dist',
    lib: {
      entry: fileURLToPath(new URL('./src/lib/index.ts', import.meta.url)),
      name: 'CuspHanger',
      fileName: 'cusphanger',
    },
    rollupOptions: {
      external: ['culori'],
      output: { globals: { culori: 'culori' } },
    },
  },
});

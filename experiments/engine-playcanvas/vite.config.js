import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 3000 },
  server: { port: 8091, host: '127.0.0.1' },
});

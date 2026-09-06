/**
 * Standalone renderer dev server — for visual QA of the overlay/settings UI
 * in a plain browser using the mock API (`?mock=<scenario>`), without
 * launching Electron. Not used by the production build.
 *
 *   npx vite -c vite.renderer-dev.config.ts
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
    },
  },
  server: {
    port: 5199,
    strictPort: true,
  },
});

import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    // Bundle everything (including workspace TS packages); only `electron`
    // and Node builtins stay external.
    plugins: [externalizeDepsPlugin({ exclude: ['@arnega/shared', '@arnega/branding'] })],
    resolve: {
      alias: {
        '@main': resolve(__dirname, 'src/main'),
      },
    },
    build: {
      sourcemap: true,
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ['@arnega/shared'] })],
    build: {
      sourcemap: true,
    },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src'),
      },
    },
    build: {
      sourcemap: true,
    },
  },
});

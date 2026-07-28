import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/mp1/',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@sensors': resolve(__dirname, '../../packages/sensors/src'),
      '@core': resolve(__dirname, '../../packages/core/src'),
      '@tokens': resolve(__dirname, '../../packages/design-tokens'),
    },
  },
});

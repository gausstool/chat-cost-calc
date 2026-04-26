import path from 'node:path';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import 'dotenv/config';

export default defineConfig(async () => ({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 1998,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve('src'),
    },
  },
  build: {
    outDir: process.env.VITE_BUILD_DIR || 'dist',
  },
}));
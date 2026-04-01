/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-router')
          ) {
            return 'vendor';
          }
          if (id.includes('node_modules/dexie')) {
            return 'db';
          }
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    testTimeout: 5000,
    coverage: {
      exclude: [
        'src/components/ui/**',
        'src/main.tsx',
        'src/App.tsx',
        'src/db/mockData.ts',
        'src/db/mockDataExtra.ts',
      ],
    },
  },
});

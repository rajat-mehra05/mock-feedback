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
          if (id.includes('node_modules/openai')) {
            return 'openai';
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
      reporter: ['text', 'json-summary', 'json', 'html'],
      exclude: [
        'src/test/**',
        'src/constants/**',
        'src/components/ui/**',
        'src/main.tsx',
        'src/App.tsx',
        'src/db/seed/mockData.ts',
        'src/db/seed/mockDataExtra.ts',
        // Browser-only: require MediaRecorder, AudioContext, navigator.mediaDevices
        'src/hooks/useAudioRecorder/**',
        'src/lib/micCheck.ts',
        'src/services/tts/**',
        'src/pages/Session/MicCheckGate.tsx',
        'src/pages/Session/RecordingTimer.tsx',
        'src/pages/Session/ConversationLog.tsx',
        'src/pages/Session/Session.tsx',
      ],
    },
  },
});

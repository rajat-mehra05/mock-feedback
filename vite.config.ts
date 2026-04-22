/// <reference types="vitest/config" />
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const isTauri = mode === 'tauri';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Don't clear the terminal so Tauri's output stays visible alongside Vite's.
    clearScreen: false,
    server: {
      // Tauri attaches to a fixed dev URL. A changed port would break it silently.
      strictPort: true,
    },
    // Expose TAURI_* env vars to app code alongside the default VITE_*.
    envPrefix: ['VITE_', 'TAURI_'],
    // Tauri production loads via a custom protocol so assets need relative paths.
    base: isTauri ? './' : '/',
    build: {
      // Tauri uses an evergreen webview (WebView2 / WKWebView 15+), so we can
      // target modern baselines and skip the heavier browserslist defaults.
      target: isTauri ? ['chrome110', 'safari15'] : undefined,
      rolldownOptions: {
        output: {
          // Phase 10: strip `console.*` calls and `debugger` statements in
          // Tauri production bundles only. On Tauri the platform logger
          // routes through `tauri-plugin-log` (file sink), so console
          // calls are purely noise. On web, the platform logger IS
          // `console.*` — stripping would silence ErrorBoundary's durable
          // diagnostics in web production, which is a regression. Dev /
          // test builds never run minify so silence-detect logs and
          // perf-mark traces stay visible regardless.
          minify: {
            compress: { dropConsole: isTauri, dropDebugger: true },
          },
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
      testTimeout: 10_000,
      coverage: {
        reporter: ['text', 'json-summary', 'json', 'html'],
        exclude: [
          'src/test/**',
          'src/constants/**',
          'src/components/ui/**',
          'src/main.tsx',
          'src/App.tsx',
          // Browser-only: require MediaRecorder, AudioContext, navigator.mediaDevices
          'src/hooks/useAudioRecorder/**',
          'src/lib/micCheck.ts',
          'src/services/tts/**',
          'src/pages/Session/MicCheckGate.tsx',
          'src/pages/Session/RecordingTimer.tsx',
          'src/pages/Session/ConversationLog.tsx',
          'src/pages/Session/Session.tsx',
          // Tauri IPC adapters need `window.__TAURI_INTERNALS__` plus
          // MediaSource/HTMLAudioElement; jsdom provides none. Contract
          // coverage happens at the service boundary via stt.test.ts,
          // streamingQuestion.test.ts, and useInterviewSession.test.tsx.
          // The pure state machine that drove ttsPlayback's edge cases
          // lives in src/lib/ttsChunkQueue.ts where it IS tested.
          'src/platform/tauri/http/**',
          // Thin OpenAI SDK wrapper — tested at the service boundary
          // (stt.test.ts uses MSW; streamingQuestion.test.ts spies on
          // `platform.http.openai.chatStream`). Adding another test layer
          // here would only verify the SDK itself.
          'src/platform/web/http/openai.ts',
        ],
      },
    },
  };
});

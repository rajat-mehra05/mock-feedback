import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { initInstallPromptCapture } from '@/lib/installPrompt';

// PWA.4: capture beforeinstallprompt before React mounts (Chromium fires it exactly once per session).
if (import.meta.env.VITE_TARGET !== 'tauri') {
  initInstallPromptCapture();

  // Display-mode telemetry attributes install-prompt funnel by surface.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const modes = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'] as const;
    const matched =
      modes.find((m) => window.matchMedia(`(display-mode: ${m})`).matches) ?? 'browser';
    void import('@/lib/analytics')
      .then(({ trackEvent }) => trackEvent('display_mode_at_session_start', { mode: matched }))
      .catch(() => {
        /* analytics best-effort */
      });
  }
}

async function boot(): Promise<void> {
  // On Tauri, block the render on the IndexedDB → keychain migration so the
  // ApiKeyProvider's initial `secrets.has(...)` check reads the post-migration
  // state. Without this, users upgrading from a pre-Phase-7 build see a
  // transient "no key configured" flash while the migration runs in the
  // background.
  if (import.meta.env.VITE_TARGET === 'tauri') {
    // Migration is best-effort: if the import or keychain fails, log and
    // continue booting. The app still works, it just retries next launch.
    try {
      const { migrateIndexedDbKeyToKeychain } = await import('@/platform/tauri/migrateApiKey');
      await migrateIndexedDbKeyToKeychain();
    } catch (err) {
      console.error('[tauri] keychain migration failed:', err);
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  // The Tauri window is created with `visible: false` to avoid a white flash
  // while the bundle boots. Show it after the first paint lands.
  if (import.meta.env.VITE_TARGET === 'tauri') {
    requestAnimationFrame(() => {
      void import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => getCurrentWindow().show())
        .catch((err) => console.error('[tauri] failed to show window:', err));
    });
  }

  // Warm the AudioWorklet so the first recording's `addModule` call is
  // a cache hit. Best-effort; chunk-load failures are swallowed and the
  // recorder's own addModule is the fallback.
  requestAnimationFrame(() => {
    import('@/lib/workletPreload')
      .then(({ preloadDownsampleWorklet }) => preloadDownsampleWorklet())
      .catch((err: unknown) => console.warn('[worklet] preload skipped:', err));
  });
}

void boot();

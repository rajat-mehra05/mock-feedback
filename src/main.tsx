import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

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

  // Phase 9.4: warm the AudioWorklet so the first recording's `addModule`
  // call is a cache hit. Fire after first paint so the preload doesn't
  // contend with the initial render. Best-effort — chunk load failures
  // (offline, flaky network) are swallowed rather than leaked as
  // unhandled rejections; the recorder's own addModule is the fallback.
  requestAnimationFrame(() => {
    import('@/lib/workletPreload')
      .then(({ preloadDownsampleWorklet }) => preloadDownsampleWorklet())
      .catch((err: unknown) => console.warn('[worklet] preload skipped:', err));
  });
}

void boot();

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
    const { migrateIndexedDbKeyToKeychain } = await import('@/platform/tauri/migrateApiKey');
    await migrateIndexedDbKeyToKeychain();
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
}

void boot();

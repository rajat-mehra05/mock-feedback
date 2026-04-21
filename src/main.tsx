import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// On Tauri, the window is created with `visible: false` to avoid a white
// flash while the bundle boots. Show it after the first paint lands.
// The dynamic import keeps @tauri-apps/api out of the web bundle entirely
// (the `if` folds to `false` at build time on web).
if (import.meta.env.VITE_TARGET === 'tauri') {
  requestAnimationFrame(() => {
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().show())
      .catch((err) => console.error('[tauri] failed to show window:', err));
  });
}

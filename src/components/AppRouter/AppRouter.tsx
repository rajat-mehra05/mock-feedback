import { BrowserRouter, HashRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Tauri production loads the renderer from a custom protocol where the HTML5
// history API cannot serve nested paths from file-like origins. HashRouter
// avoids that because the fragment stays client-side. Web keeps BrowserRouter
// for clean, shareable URLs and SEO.
export function AppRouter({ children }: { children: ReactNode }) {
  const Router = import.meta.env.VITE_TARGET === 'tauri' ? HashRouter : BrowserRouter;
  return <Router>{children}</Router>;
}

import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

// PWA update prompt. Renders only when a new SW is waiting (i.e. a new
// build is deployed and the SW has installed but not yet activated).
//
// vite.config.ts uses registerType: 'prompt', meaning the SW won't auto-
// apply. The user clicks Refresh to call updateServiceWorker(true), which
// posts SKIP_WAITING to the waiting worker and reloads the page once the
// new one takes control.
//
// Copy adapts based on route:
//   /session  → warns about losing the in-flight interview
//   anything else → neutral "Refresh to apply" prompt
//
// On Tauri, the import resolves to a no-op stub (see vite.config.ts
// alias) and needRefresh stays false forever, so the component renders
// nothing. App.tsx still gates the render by VITE_TARGET so this stub
// path is just defence in depth.
export function UpdateBanner() {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error) => {
      // SW registration is best-effort. A failure shouldn't break the app.
      console.error('SW registration failed', error);
    },
  });

  if (!needRefresh || dismissed) return null;

  const inSession = pathname.startsWith('/session');
  const message = inSession
    ? 'Update ready. Finish your interview before refreshing.'
    : 'Update ready. Refresh to apply.';

  const handleRefresh = () => {
    void updateServiceWorker(true);
  };

  const handleDismiss = () => {
    setNeedRefresh(false);
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md items-center gap-3 border-2 border-black bg-neo-secondary px-4 py-3 shadow-neo-md sm:left-auto sm:right-4"
    >
      <span className="flex-1 text-sm font-medium text-black">{message}</span>
      <Button size="sm" onClick={handleRefresh} disabled={inSession}>
        Refresh
      </Button>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss update notice"
        className="flex h-8 w-8 cursor-pointer items-center justify-center border-2 border-transparent text-black/60 hover:border-black hover:text-black focus-visible:border-black focus-visible:outline-none"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

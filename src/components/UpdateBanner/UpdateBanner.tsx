import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

// Renders only when a new SW is waiting; user-clicked Refresh applies it.
// Tauri builds get a no-op stub via vite.config.ts alias.
export function UpdateBanner() {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: (error) => {
      console.error('SW registration failed', error);
    },
  });

  if (!needRefresh || dismissed) return null;

  // Strict boundary so a future '/sessions' route doesn't silently disable refresh.
  const inSession = pathname === '/session' || pathname.startsWith('/session/');
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

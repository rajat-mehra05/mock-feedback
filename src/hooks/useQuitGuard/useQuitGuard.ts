import { useEffect, useRef } from 'react';
import { platform } from '@/platform';

// Tauri-only: confirm before close while `shouldBlock` is true. Web is a
// no-op; `beforeunload` warnings are unreliable and user-hostile.
export function useQuitGuard(shouldBlock: boolean, message: string): void {
  const blockRef = useRef(shouldBlock);
  blockRef.current = shouldBlock;

  useEffect(() => {
    if (import.meta.env.VITE_TARGET !== 'tauri') return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        if (cancelled) return;
        const off = await getCurrentWindow().onCloseRequested((event) => {
          if (!blockRef.current) return;
          if (!window.confirm(message)) event.preventDefault();
        });
        // Cleanup may have fired mid-await; tear the listener down instead of leaking it.
        if (cancelled) {
          off();
          return;
        }
        unlisten = off;
      } catch (err) {
        // Dynamic import or registration failed; app still works, guard just won't prompt.
        platform.logger.error('useQuitGuard failed to register close listener', err);
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [message]);
}

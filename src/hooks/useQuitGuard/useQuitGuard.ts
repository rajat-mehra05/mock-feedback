import { useEffect, useRef } from 'react';

/**
 * Phase 10: intercept the Tauri window close event while `shouldBlock` is
 * true and surface a confirm dialog. Web is a no-op — browser tabs don't
 * have a first-class "about to close" we can intercept the same way, and
 * tab-close warnings via `beforeunload` are unreliable and user-hostile.
 *
 * `shouldBlock` is read via a ref at close time so the listener registers
 * exactly once and always sees the latest value. Taking a boolean directly
 * (rather than a getter callback) keeps the call site free of `useCallback`
 * wrapping and avoids re-registering the listener on every status change
 * in the caller.
 */
export function useQuitGuard(shouldBlock: boolean, message: string): void {
  const blockRef = useRef(shouldBlock);
  blockRef.current = shouldBlock;

  useEffect(() => {
    if (import.meta.env.VITE_TARGET !== 'tauri') return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      if (cancelled) return;
      const off = await getCurrentWindow().onCloseRequested((event) => {
        if (!blockRef.current) return;
        if (!window.confirm(message)) event.preventDefault();
      });
      // Cleanup may have fired during the awaited registration. Tear the
      // listener down immediately instead of leaking it.
      if (cancelled) {
        off();
        return;
      }
      unlisten = off;
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [message]);
}

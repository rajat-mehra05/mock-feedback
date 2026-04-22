import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { platform } from '@/platform';
import type { UpdateInfo } from '@/platform';

/**
 * Phase 10: non-blocking toast that fires once per launch when a newer
 * GitHub release exists. Silent on network / API / parse failures so we
 * don't pester users on flaky connections — the Settings "Check for
 * updates" button is the explicit path that surfaces errors.
 *
 * Render this once in `App.tsx`. On web it no-ops via the adapter
 * returning `null` from `checkForUpdate`.
 */
export function UpdateToast() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void platform.updater
      .checkForUpdate()
      .then((info) => {
        if (!cancelled) setUpdate(info);
      })
      .catch(() => {
        // Adapter already swallows its own errors. Defence in depth.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!update || dismissed) return null;

  const handleDownload = () => {
    void platform.updater.openReleasePage(update.htmlUrl);
    setDismissed(true);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-md border-2 border-black bg-neo-accent px-4 py-3 shadow-neo-md"
    >
      <span className="text-sm font-medium text-black">
        Update available: v{update.latestVersion}
      </span>
      <Button size="sm" onClick={handleDownload}>
        Download
      </Button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update notice"
        className="text-sm text-black/60 hover:text-black"
      >
        ✕
      </button>
    </div>
  );
}

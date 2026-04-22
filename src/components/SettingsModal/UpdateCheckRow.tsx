import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { platform } from '@/platform';

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up_to_date' }
  | { kind: 'available'; version: string; url: string }
  | { kind: 'error' };

/**
 * Phase 10: explicit "check for updates" path in Settings. Unlike the
 * on-launch toast (which is silent on errors to avoid pestering users on
 * flaky networks), this surfaces check failures so the user knows whether
 * their build is actually up to date or the check just didn't reach
 * GitHub.
 */
export function UpdateCheckRow() {
  const [state, setState] = useState<CheckState>({ kind: 'idle' });

  const handleCheck = useCallback(async () => {
    setState({ kind: 'checking' });
    try {
      const info = await platform.updater.checkForUpdate();
      if (info) {
        setState({ kind: 'available', version: info.latestVersion, url: info.htmlUrl });
      } else {
        setState({ kind: 'up_to_date' });
      }
    } catch {
      setState({ kind: 'error' });
    }
  }, []);

  const handleDownload = useCallback(async () => {
    if (state.kind !== 'available') return;
    await platform.updater.openReleasePage(state.url);
  }, [state]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold uppercase tracking-wider">Updates</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void handleCheck()}
          disabled={state.kind === 'checking'}
        >
          {state.kind === 'checking' ? 'Checking…' : 'Check for updates'}
        </Button>
      </div>
      <div className="text-sm font-bold" aria-live="polite">
        {state.kind === 'up_to_date' && <span className="text-green-700">Up to date.</span>}
        {state.kind === 'error' && (
          <span className="text-red-700">
            Couldn&apos;t reach GitHub. Check your connection and try again.
          </span>
        )}
        {state.kind === 'available' && (
          <div className="flex items-center gap-2">
            <span className="text-black">
              New version available: <strong>v{state.version}</strong>
            </span>
            <Button type="button" size="sm" onClick={() => void handleDownload()}>
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

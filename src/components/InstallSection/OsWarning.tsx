import type { DownloadTarget } from '@/lib/detectDownloadTarget';
import { CopyableCommand } from './CopyableCommand';

interface OsWarningProps {
  platform: DownloadTarget;
}

// `-dr` is recursive: the DMG drag-install puts the quarantine attribute on
// nested files inside the bundle too, so a non-recursive `-d` leaves most of
// the .app still quarantined and the Gatekeeper prompt returns.
const MAC_QUARANTINE_COMMAND = 'xattr -dr com.apple.quarantine /Applications/VoiceRound.app';

export function OsWarning({ platform }: OsWarningProps) {
  const isMac = platform === 'mac';
  return (
    <div className="flex-1 lg:max-w-md">
      <p className="mb-3 text-xs font-black uppercase tracking-widest text-black/50">
        Expect a one-time OS warning
      </p>
      <div className="space-y-4 border-l-4 border-black bg-neo-secondary/30 p-6">
        {isMac ? <MacWarning /> : <WindowsWarning />}
      </div>
    </div>
  );
}

function MacWarning() {
  return (
    <>
      <p className="text-sm font-medium text-black/80">
        macOS flags unsigned builds with{' '}
        <span className="font-bold">&ldquo;unidentified developer&rdquo;</span>. Expected for
        open-source apps. In Finder, <span className="font-bold">right-click</span> VoiceRound in
        Applications → <span className="font-bold">Open</span> →{' '}
        <span className="font-bold">Open</span>. macOS trusts it from then on.
      </p>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-black/60">
          If that doesn&apos;t work, run in Terminal:
        </p>
        <CopyableCommand command={MAC_QUARANTINE_COMMAND} />
      </div>
    </>
  );
}

function WindowsWarning() {
  return (
    <p className="text-sm font-medium text-black/80">
      Windows SmartScreen flags unsigned builds with{' '}
      <span className="font-bold">&ldquo;Windows protected your PC&rdquo;</span>. Click{' '}
      <span className="font-bold">More info</span> → <span className="font-bold">Run anyway</span>.
      The warning doesn&apos;t appear on future launches.
    </p>
  );
}

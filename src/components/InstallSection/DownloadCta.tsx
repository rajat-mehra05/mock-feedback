import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { fetchLatestRelease, pickAssetForPlatform } from '@/lib/githubLatestRelease';
import { triggerDownload } from '@/lib/triggerDownload';
import { GITHUB_RELEASES_URL } from '@/constants/copy';
import type { TauriOs } from './OsWarning';

type Status = 'idle' | 'fetching' | 'error';

const PLATFORM_LABEL: Record<TauriOs, string> = {
  mac: 'macOS',
  windows: 'Windows',
};

function getPrimaryLabel(status: Status, platformLabel: string): string {
  if (status === 'fetching') return 'Preparing download…';
  if (status === 'error') return 'Open releases page';
  return `Download for ${platformLabel}`;
}

interface DownloadCtaProps {
  platform: TauriOs;
  onSwitch: (next: TauriOs) => void;
}

export function DownloadCta({ platform, onSwitch }: DownloadCtaProps) {
  const [status, setStatus] = useState<Status>('idle');
  const otherPlatform: TauriOs = platform === 'mac' ? 'windows' : 'mac';
  const platformLabel = PLATFORM_LABEL[platform];
  const otherLabel = PLATFORM_LABEL[otherPlatform];
  const primaryLabel = getPrimaryLabel(status, platformLabel);

  async function handleDownload(target: TauriOs): Promise<void> {
    onSwitch(target);

    // Error-state retry on the same platform matches the "Open releases page"
    // label: skip the fetch and go straight to GitHub.
    if (status === 'error' && target === platform) {
      window.open(GITHUB_RELEASES_URL, '_blank', 'noopener,noreferrer');
      return;
    }

    setStatus('fetching');
    try {
      const release = await fetchLatestRelease();
      const asset = pickAssetForPlatform(release.assets, target);
      if (!asset) {
        throw new Error(`No ${target === 'mac' ? '.dmg' : '.exe'} asset on the latest release`);
      }
      triggerDownload(asset.browser_download_url, asset.name);
      setStatus('idle');
    } catch {
      // No auto window.open: user activation is consumed by the await chain,
      // so popup blockers treat it as programmatic. The error-state button
      // exposes a synchronous retry that keeps activation intact.
      setStatus('error');
    }
  }

  return (
    <div className="flex-1 space-y-5">
      <p className="text-xs font-black uppercase tracking-widest text-black/50">
        Lives in your dock
      </p>

      <h2 className="text-xl font-black uppercase leading-tight tracking-tight text-black sm:text-4xl">
        You&apos;re on{' '}
        <span className="relative inline-block whitespace-nowrap">
          <span className="relative z-10">{platformLabel}.</span>
          <span
            className="absolute bottom-1 left-0 -z-0 h-3 w-full -rotate-1 bg-neo-accent"
            aria-hidden="true"
          />
        </span>
      </h2>

      <button
        type="button"
        onClick={() => void handleDownload(platform)}
        disabled={status === 'fetching'}
        // Coral gradient layered over bg-neo-accent (#ff6b6b). Hex pinned
        // because Tailwind v4 @theme can't derive shifted shades.
        className={`${buttonVariants({ size: 'lg' })} h-14 min-w-[280px] bg-gradient-to-br from-[#ff7676] to-[#ff5757] text-base`}
      >
        {status === 'fetching' ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <Download className="h-5 w-5" aria-hidden="true" />
        )}
        {primaryLabel}
      </button>

      <p className="text-sm font-bold text-black/60">
        Also available for{' '}
        <button
          type="button"
          onClick={() => void handleDownload(otherPlatform)}
          disabled={status === 'fetching'}
          className="cursor-pointer underline hover:bg-neo-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {otherLabel}
        </button>
      </p>
    </div>
  );
}

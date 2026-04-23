import { getVersion } from '@tauri-apps/api/app';
import { error as logError } from '@tauri-apps/plugin-log';
import { open as openShellUrl } from '@tauri-apps/plugin-shell';
import type { UpdateInfo, UpdaterAdapter } from '../types';
import { semverGreaterThan } from '@/lib/semverCompare';
import { fetchLatestRelease, type GitHubRelease } from '@/lib/githubLatestRelease';

/** Exposed for test. Returns true only for an `https://github.com/…` URL
 *  under this repo's `/releases` path. Parses with `URL` so a spoofed
 *  string like `https://github.com.evil.tld/…` or `https://github.com@evil/…`
 *  can't sneak past a naive `startsWith` check. */
export function isAllowedReleaseUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.host !== 'github.com') return false;
  return (
    parsed.pathname === '/rajat-mehra05/voice-round/releases' ||
    parsed.pathname.startsWith('/rajat-mehra05/voice-round/releases/')
  );
}

/** Exposed for test: pure comparison with injectable dependencies. */
export function computeUpdateInfo(
  currentVersion: string,
  latestRelease: GitHubRelease | null,
): UpdateInfo | null {
  if (!latestRelease) return null;
  const tag = latestRelease.tag_name;
  if (!semverGreaterThan(tag, currentVersion)) return null;
  return {
    latestVersion: tag.startsWith('v') ? tag.slice(1) : tag,
    htmlUrl: latestRelease.html_url,
  };
}

export const tauriUpdater: UpdaterAdapter = {
  async checkForUpdate() {
    const [currentVersion, latest] = await Promise.all([getVersion(), fetchLatestRelease()]);
    return computeUpdateInfo(currentVersion, latest);
  },
  async openReleasePage(url: string) {
    if (!isAllowedReleaseUrl(url)) {
      // Defence in depth: the capability-level regex in tauri.conf.json
      // will also reject this, but we'd rather fail silently in JS than
      // surface a Rust panic via the IPC bridge to an end user.
      return;
    }
    try {
      await openShellUrl(url);
    } catch (err) {
      // Capability rejection or IPC failure. Log for diagnostics and
      // swallow — the caller already ran `isAllowedReleaseUrl`, so we
      // know the URL isn't the issue from our side, and the user just
      // sees "nothing happened" which is better than an unhandled
      // rejection bubbling out of the adapter.
      logError(`openReleasePage failed: ${err instanceof Error ? err.message : String(err)}`).catch(
        () => {},
      );
    }
  },
};

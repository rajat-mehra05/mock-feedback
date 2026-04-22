import { getVersion } from '@tauri-apps/api/app';
import { open as openShellUrl } from '@tauri-apps/plugin-shell';
import type { UpdateInfo, UpdaterAdapter } from '../types';
import { semverGreaterThan } from '@/lib/semverCompare';

/**
 * GitHub Releases update check. `releases/latest` excludes drafts and
 * prereleases automatically, which matches the plan's stable-only release
 * strategy. Unauthenticated API rate limit is 60/hour/IP — one launch check
 * per app start plus occasional manual checks stays well within it.
 *
 * Public read endpoints on github.com/api no longer require `User-Agent`
 * for webview clients, and fetch forbids setting it from JS anyway. We
 * rely on the webview's default UA.
 */
const RELEASES_URL = 'https://api.github.com/repos/rajat-mehra05/voice-round/releases/latest';
/** Cap the check so a slow / stalled connection can't leave the toast
 *  spinning forever. 8s is long enough for a cold TLS handshake on mobile
 *  networks, short enough that the launch path stays responsive. */
const FETCH_TIMEOUT_MS = 8_000;

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

interface GitHubRelease {
  tag_name: string;
  html_url: string;
}

/** Exposed for test: the HTTP branch that talks to GitHub. Returns the
 *  minimal shape on success and `null` on any failure (non-2xx, network
 *  error, timeout, missing fields, JSON parse error). The caller must
 *  treat `null` as "can't check" — never as "no update." */
export async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<GitHubRelease>;
    if (typeof body.tag_name !== 'string' || typeof body.html_url !== 'string') return null;
    return { tag_name: body.tag_name, html_url: body.html_url };
  } catch {
    // Network failures / timeout / parse errors all map to "can't check" so
    // the launch path stays silent. Settings UI surfaces errors explicitly.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Exposed for test: same logic with injectable dependencies. */
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
    await openShellUrl(url);
  },
};

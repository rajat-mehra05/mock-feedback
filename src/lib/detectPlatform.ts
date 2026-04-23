// Richer platform detection for PWA.4 install UX. Replaces the old
// detectDownloadTarget (which lied to mobile visitors by always
// falling back to 'mac').
//
// Kept pure on purpose so tests can drive it with fixture UA strings.
// The production wrapper `getCurrentPlatform()` reads from window +
// navigator at call time and forwards to the pure function.

export type Device = 'mobile' | 'desktop';
export type Os = 'ios' | 'android' | 'mac' | 'windows' | 'linux' | 'unknown';
export type Browser = 'chromium' | 'firefox' | 'safari' | 'unknown';

export interface Platform {
  device: Device;
  os: Os;
  browser: Browser;
  /**
   * True iff the InstallSection should render a PWA install affordance
   * for this user (either a programmatic prompt or manual A2HS
   * instructions).
   *
   * Chromium on any OS: has beforeinstallprompt.
   * Firefox on Android: no event but has a menu install affordance,
   *   we show the same CTA and let the browser handle it.
   * Safari on iOS: no event, we show Add-to-Home-Screen instructions.
   * Desktop Safari / Desktop Firefox: no programmatic path; CTA hidden.
   */
  supportsPwaInstall: boolean;
  /**
   * True iff the user is currently inside an installed PWA (matchMedia
   * display-mode standalone OR iOS navigator.standalone).
   */
  isStandalone: boolean;
}

export interface DetectInput {
  userAgent: string;
  navigatorPlatform: string;
  maxTouchPoints: number;
  matchesStandaloneDisplayMode: boolean;
  iosStandalone: boolean;
}

function detectBrowser(userAgent: string): Browser {
  // Order matters. Firefox's UA has no "Chrome" so safe to check first.
  if (/Firefox\//.test(userAgent)) return 'firefox';
  // Chromium covers Chrome, Edge (Edg/), Brave, Opera, Samsung Internet.
  // Edge/Brave/Opera include "Chrome" in their UA so a single Chrome test
  // matches all of them without a special case per browser.
  if (/Chrome\//.test(userAgent) || /Chromium\//.test(userAgent)) return 'chromium';
  // Safari must be last because other browsers include Safari in their UA.
  if (/Safari\//.test(userAgent)) return 'safari';
  return 'unknown';
}

function detectOs(input: DetectInput): Os {
  const { userAgent, navigatorPlatform, maxTouchPoints } = input;

  // Android before Linux: Android UAs contain "Linux" too.
  if (/Android/.test(userAgent)) return 'android';

  // iPhone / iPod always carry those substrings.
  if (/iPhone|iPod/.test(userAgent)) return 'ios';

  // iPad in mobile mode still has "iPad" in the UA.
  if (/iPad/.test(userAgent)) return 'ios';

  // iPadOS 13+ "desktop mode" sends a Mac-shaped UA. The disambiguation
  // is a touch-capable device claiming MacIntel. Desktop Macs report
  // maxTouchPoints of 0 or 1 (trackpad); iPads report 5.
  if (/Macintosh/.test(userAgent) && navigatorPlatform === 'MacIntel' && maxTouchPoints > 1) {
    return 'ios';
  }

  if (/Windows/.test(userAgent)) return 'windows';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'mac';
  if (/Linux/.test(userAgent)) return 'linux';
  return 'unknown';
}

function detectDevice(os: Os): Device {
  // iOS (iPhone, iPad) and Android are always mobile. Mac/Windows/Linux
  // are always desktop. Unknown defaults to desktop because the
  // InstallSection's Tauri download path is the safer fallback: on a
  // mobile browser we'd misdetected, users at least see something
  // rather than an empty CTA.
  if (os === 'ios' || os === 'android') return 'mobile';
  return 'desktop';
}

function detectPwaInstallSupport(os: Os, browser: Browser, device: Device): boolean {
  // Chromium everywhere: has beforeinstallprompt.
  if (browser === 'chromium') return true;
  // Firefox Android: no event but has manual install via menu. Show the
  // same CTA shape; the browser UI handles the rest.
  if (browser === 'firefox' && device === 'mobile') return true;
  // iOS Safari: no event, but we render Add-to-Home-Screen instructions.
  if (browser === 'safari' && os === 'ios') return true;
  // Desktop Safari (Sonoma+): has File → Add to Dock menu but no JS API.
  // We don't expose a CTA because the user has to invoke it manually.
  // Desktop Firefox: no PWA install support at all.
  return false;
}

export function detectPlatform(input: DetectInput): Platform {
  const browser = detectBrowser(input.userAgent);
  const os = detectOs(input);
  const device = detectDevice(os);
  const supportsPwaInstall = detectPwaInstallSupport(os, browser, device);
  const isStandalone = input.matchesStandaloneDisplayMode || input.iosStandalone;
  return { device, os, browser, supportsPwaInstall, isStandalone };
}

/**
 * Production wrapper reading from window + navigator at call time.
 * Safe to call during SSR — returns an "unknown, desktop, not
 * standalone" shape when window is unavailable.
 */
export function getCurrentPlatform(): Platform {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      device: 'desktop',
      os: 'unknown',
      browser: 'unknown',
      supportsPwaInstall: false,
      isStandalone: false,
    };
  }
  const nav = navigator as Navigator & { standalone?: boolean };
  // matchMedia missing happens in jsdom and very old browsers. Treat
  // standalone as false in that case rather than throwing on first
  // render of the InstallSection.
  const matches =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false;
  return detectPlatform({
    userAgent: navigator.userAgent,
    navigatorPlatform: navigator.platform ?? '',
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    matchesStandaloneDisplayMode: matches,
    iosStandalone: nav.standalone === true,
  });
}

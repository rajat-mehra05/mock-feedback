// Platform detection for PWA.4 install UX; pure for testability.
// getCurrentPlatform() is the production wrapper that reads navigator.

export type Device = 'mobile' | 'desktop';
export type Os = 'ios' | 'android' | 'mac' | 'windows' | 'linux' | 'unknown';
export type Browser = 'chromium' | 'firefox' | 'safari' | 'unknown';

export interface Platform {
  device: Device;
  os: Os;
  browser: Browser;
  /** Render an install CTA: Chromium any-OS + Firefox Android (menu) + iOS Safari (A2HS). */
  supportsPwaInstall: boolean;
  /** matchMedia display-mode standalone OR iOS navigator.standalone. */
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
  // Order matters: Edge/Brave/Opera include "Chrome"; Safari must be last.
  if (/Firefox\//.test(userAgent)) return 'firefox';
  if (/Chrome\//.test(userAgent) || /Chromium\//.test(userAgent)) return 'chromium';
  if (/Safari\//.test(userAgent)) return 'safari';
  return 'unknown';
}

function detectOs(input: DetectInput): Os {
  const { userAgent, navigatorPlatform, maxTouchPoints } = input;

  // Android before Linux (Android UAs contain "Linux").
  if (/Android/.test(userAgent)) return 'android';
  if (/iPhone|iPod/.test(userAgent)) return 'ios';
  if (/iPad/.test(userAgent)) return 'ios';

  // iPadOS 13+ desktop mode sends a Mac UA; disambiguate via maxTouchPoints (Macs report 0-1).
  if (/Macintosh/.test(userAgent) && navigatorPlatform === 'MacIntel' && maxTouchPoints > 1) {
    return 'ios';
  }

  if (/Windows/.test(userAgent)) return 'windows';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'mac';
  if (/Linux/.test(userAgent)) return 'linux';
  return 'unknown';
}

function detectDevice(os: Os): Device {
  // Unknown defaults to desktop: better to show the Tauri download CTA than nothing.
  if (os === 'ios' || os === 'android') return 'mobile';
  return 'desktop';
}

function detectPwaInstallSupport(os: Os, browser: Browser, device: Device): boolean {
  if (browser === 'chromium') return true;
  if (browser === 'firefox' && device === 'mobile') return true;
  if (browser === 'safari' && os === 'ios') return true;
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

// Production wrapper; SSR-safe (returns desktop/unknown when window is missing).
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

import { test, expect } from 'vitest';
import { detectPlatform, type DetectInput } from './detectPlatform';

// Real UA strings; misdetection here ships a misleading install CTA.
const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  ipadMobile:
    'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
  // iPadOS 13+ desktop mode: UA matches macOS, disambiguated via maxTouchPoints > 1.
  ipadDesktopMode:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  macChrome:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/121.0 Firefox/121.0',
  linuxChrome:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function base(overrides: Partial<DetectInput> & { userAgent: string }): DetectInput {
  return {
    navigatorPlatform: '',
    maxTouchPoints: 0,
    matchesStandaloneDisplayMode: false,
    iosStandalone: false,
    ...overrides,
  };
}

test('iPhone Safari detects as mobile ios safari, PWA install supported via A2HS', () => {
  const p = detectPlatform(base({ userAgent: UA.iphoneSafari }));
  expect(p.device).toBe('mobile');
  expect(p.os).toBe('ios');
  expect(p.browser).toBe('safari');
  expect(p.supportsPwaInstall).toBe(true);
  expect(p.isStandalone).toBe(false);
});

test('iPad in mobile mode detects as mobile ios safari', () => {
  const p = detectPlatform(base({ userAgent: UA.ipadMobile }));
  expect(p.device).toBe('mobile');
  expect(p.os).toBe('ios');
  expect(p.browser).toBe('safari');
});

test('iPad in desktop mode disambiguates via MacIntel + maxTouchPoints > 1', () => {
  const p = detectPlatform(
    base({
      userAgent: UA.ipadDesktopMode,
      navigatorPlatform: 'MacIntel',
      maxTouchPoints: 5,
    }),
  );
  expect(p.device).toBe('mobile');
  expect(p.os).toBe('ios');
});

test('desktop Mac with same UA but no touch does NOT get classified as iOS', () => {
  // Macs report maxTouchPoints 0-1; the iPad disambiguation must not false-positive.
  const p = detectPlatform(
    base({
      userAgent: UA.macSafari,
      navigatorPlatform: 'MacIntel',
      maxTouchPoints: 0,
    }),
  );
  expect(p.device).toBe('desktop');
  expect(p.os).toBe('mac');
});

test('Android Chrome detects as mobile android chromium, supports PWA install', () => {
  const p = detectPlatform(base({ userAgent: UA.androidChrome }));
  expect(p.device).toBe('mobile');
  expect(p.os).toBe('android');
  expect(p.browser).toBe('chromium');
  expect(p.supportsPwaInstall).toBe(true);
});

test('Android Firefox detects as mobile android firefox, supports PWA install (manual via menu)', () => {
  const p = detectPlatform(base({ userAgent: UA.androidFirefox }));
  expect(p.device).toBe('mobile');
  expect(p.os).toBe('android');
  expect(p.browser).toBe('firefox');
  expect(p.supportsPwaInstall).toBe(true);
});

test('macOS Safari desktop does NOT support PWA install (Add to Dock has no JS API)', () => {
  const p = detectPlatform(base({ userAgent: UA.macSafari }));
  expect(p.device).toBe('desktop');
  expect(p.os).toBe('mac');
  expect(p.browser).toBe('safari');
  expect(p.supportsPwaInstall).toBe(false);
});

test('macOS Chrome desktop supports PWA install via beforeinstallprompt', () => {
  const p = detectPlatform(base({ userAgent: UA.macChrome }));
  expect(p.device).toBe('desktop');
  expect(p.os).toBe('mac');
  expect(p.browser).toBe('chromium');
  expect(p.supportsPwaInstall).toBe(true);
});

test('Windows Chrome desktop supports PWA install', () => {
  const p = detectPlatform(base({ userAgent: UA.winChrome }));
  expect(p.device).toBe('desktop');
  expect(p.os).toBe('windows');
  expect(p.browser).toBe('chromium');
  expect(p.supportsPwaInstall).toBe(true);
});

test('Windows Edge detects as chromium (not a separate browser category)', () => {
  const p = detectPlatform(base({ userAgent: UA.winEdge }));
  expect(p.browser).toBe('chromium');
  expect(p.supportsPwaInstall).toBe(true);
});

test('Windows Firefox desktop does NOT support PWA install', () => {
  const p = detectPlatform(base({ userAgent: UA.winFirefox }));
  expect(p.device).toBe('desktop');
  expect(p.os).toBe('windows');
  expect(p.browser).toBe('firefox');
  expect(p.supportsPwaInstall).toBe(false);
});

test('Linux Chrome desktop supports PWA install', () => {
  const p = detectPlatform(base({ userAgent: UA.linuxChrome }));
  expect(p.device).toBe('desktop');
  expect(p.os).toBe('linux');
  expect(p.browser).toBe('chromium');
  expect(p.supportsPwaInstall).toBe(true);
});

test('matchMedia display-mode standalone sets isStandalone to true', () => {
  const p = detectPlatform(
    base({
      userAgent: UA.winChrome,
      matchesStandaloneDisplayMode: true,
    }),
  );
  expect(p.isStandalone).toBe(true);
});

test('iOS navigator.standalone (legacy path) sets isStandalone to true', () => {
  // Older iOS A2HS doesn't fire the display-mode media query; navigator.standalone is the reliable signal.
  const p = detectPlatform(
    base({
      userAgent: UA.iphoneSafari,
      iosStandalone: true,
      matchesStandaloneDisplayMode: false,
    }),
  );
  expect(p.isStandalone).toBe(true);
});

test('empty UA falls back to unknown+desktop (safe default for install CTA)', () => {
  // Bias towards desktop CTA over empty section when detection fails.
  const p = detectPlatform(base({ userAgent: '' }));
  expect(p.device).toBe('desktop');
  expect(p.os).toBe('unknown');
  expect(p.browser).toBe('unknown');
  expect(p.supportsPwaInstall).toBe(false);
});

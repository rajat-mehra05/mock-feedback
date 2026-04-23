// Capture and expose the Chromium beforeinstallprompt event.
//
// The browser fires beforeinstallprompt when its engagement heuristics
// decide the user might want to install. The event is one-shot: if you
// don't preventDefault and stash it before the next yield, the chance
// to call .prompt() later is gone. So we register the listener at app
// boot in main.tsx (before React mounts) and stash the event in a
// module-level ref. UI code reads the current value via the
// useInstallPrompt hook and gets re-rendered when the event fires or
// when the app is installed.
//
// Module-level state is intentional. A React context provider wouldn't
// help because the listener has to be in place before React mounts,
// and Chromium fires the event exactly once per session.

import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let stashedEvent: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
const subscribers = new Set<() => void>();

// Hold references so __resetForTests can detach the real listeners.
// Production code never calls __resetForTests, so this lives unused there.
let beforeInstallPromptListener: ((event: Event) => void) | null = null;
let appInstalledListener: (() => void) | null = null;

function notify() {
  for (const cb of subscribers) cb();
}

function subscribe(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function getSnapshot(): BeforeInstallPromptEvent | null {
  return stashedEvent;
}

function getAppInstalledSnapshot(): boolean {
  return appInstalled;
}

/**
 * Wire up the global beforeinstallprompt and appinstalled listeners.
 * Call exactly once, as early as possible (main.tsx, before React
 * mounts). Idempotent: a second call is a no-op.
 */
export function initInstallPromptCapture(): void {
  if (typeof window === 'undefined') return;
  if ((window as Window & { __vrInstallPromptInit?: boolean }).__vrInstallPromptInit) return;
  (window as Window & { __vrInstallPromptInit?: boolean }).__vrInstallPromptInit = true;

  beforeInstallPromptListener = (event: Event) => {
    // preventDefault stops Chromium's own mini-infobar from racing the
    // in-app CTA. The event stays usable after preventDefault.
    event.preventDefault();
    stashedEvent = event as BeforeInstallPromptEvent;
    notify();
  };
  appInstalledListener = () => {
    appInstalled = true;
    // Drop the stashed event: it's spent, and the install CTA should
    // hide immediately even before the next reload.
    stashedEvent = null;
    // Defer the telemetry import so the analytics module loads only when
    // the event actually fires (rare). Avoids pulling the analytics
    // chunk into the entry bundle.
    void import('@/lib/analytics')
      .then(({ trackEvent }) => trackEvent('pwa_appinstalled'))
      .catch(() => {
        /* analytics is best-effort; never block the install flow on it */
      });
    notify();
  };
  window.addEventListener('beforeinstallprompt', beforeInstallPromptListener);
  window.addEventListener('appinstalled', appInstalledListener);
}

/**
 * Mark the stashed beforeinstallprompt event as consumed. Call this
 * after the user has clicked the install CTA and the browser's prompt
 * has resolved (regardless of accepted/dismissed outcome). Chromium
 * rejects a second .prompt() call on the same event, so the UI must
 * stop offering to call it.
 *
 * Notifying subscribers means the disabled={!promptEvent} state on
 * install buttons flips back to disabled, which matches reality:
 * there's no usable prompt to fire anymore. If the user dismissed,
 * Chromium typically suppresses re-prompts for ~90 days; if they
 * accepted, the appinstalled event will fire and clear the CTA via a
 * different code path.
 */
export function consumeInstallPrompt(): void {
  if (stashedEvent === null) return;
  stashedEvent = null;
  notify();
}

/**
 * Returns the most recent beforeinstallprompt event (or null if Chrome
 * hasn't fired one yet) and the appinstalled flag. Components re-render
 * when either changes.
 */
export function useInstallPrompt() {
  const event = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const installed = useSyncExternalStore(subscribe, getAppInstalledSnapshot, () => false);
  return { event, installed };
}

/**
 * Test-only escape hatch to clear the stashed event between cases.
 * Not exported via index; only used in installPrompt.test.ts.
 */
export function __resetForTests() {
  stashedEvent = null;
  appInstalled = false;
  subscribers.clear();
  if (typeof window !== 'undefined') {
    if (beforeInstallPromptListener) {
      window.removeEventListener('beforeinstallprompt', beforeInstallPromptListener);
    }
    if (appInstalledListener) {
      window.removeEventListener('appinstalled', appInstalledListener);
    }
    delete (window as Window & { __vrInstallPromptInit?: boolean }).__vrInstallPromptInit;
  }
  beforeInstallPromptListener = null;
  appInstalledListener = null;
}

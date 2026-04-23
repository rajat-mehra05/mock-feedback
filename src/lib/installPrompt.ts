// Capture beforeinstallprompt before React mounts; the event is one-shot per session.
// Module-level state because the listener must register before React.

import { useSyncExternalStore } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let stashedEvent: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
const subscribers = new Set<() => void>();

// Held so __resetForTests can detach listeners.
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

// Idempotent. Call from main.tsx before React mounts.
export function initInstallPromptCapture(): void {
  if (typeof window === 'undefined') return;
  if ((window as Window & { __vrInstallPromptInit?: boolean }).__vrInstallPromptInit) return;
  (window as Window & { __vrInstallPromptInit?: boolean }).__vrInstallPromptInit = true;

  beforeInstallPromptListener = (event: Event) => {
    // preventDefault suppresses Chromium's native infobar so our CTA owns the prompt.
    event.preventDefault();
    stashedEvent = event as BeforeInstallPromptEvent;
    notify();
  };
  appInstalledListener = () => {
    appInstalled = true;
    stashedEvent = null;
    // Lazy analytics import keeps the rare-event chunk out of the entry bundle.
    void import('@/lib/analytics')
      .then(({ trackEvent }) => trackEvent('pwa_appinstalled'))
      .catch(() => undefined);
    notify();
  };
  window.addEventListener('beforeinstallprompt', beforeInstallPromptListener);
  window.addEventListener('appinstalled', appInstalledListener);
}

// Clear the stashed event after the user has triggered the prompt; Chromium rejects a second .prompt() call.
export function consumeInstallPrompt(): void {
  if (stashedEvent === null) return;
  stashedEvent = null;
  notify();
}

export function useInstallPrompt() {
  const event = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const installed = useSyncExternalStore(subscribe, getAppInstalledSnapshot, () => false);
  return { event, installed };
}

// Test-only escape hatch.
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

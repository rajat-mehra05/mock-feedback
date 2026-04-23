import { test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { initInstallPromptCapture, useInstallPrompt, __resetForTests } from './installPrompt';

beforeEach(() => {
  __resetForTests();
});

function fireBeforeInstallPrompt(): Event {
  // jsdom can't construct the real BeforeInstallPromptEvent; fake the shape.
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
    platforms: string[];
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'web' });
  event.platforms = ['web'];
  window.dispatchEvent(event);
  return event;
}

test('initInstallPromptCapture stashes the event for later .prompt() calls', () => {
  initInstallPromptCapture();
  const { result } = renderHook(() => useInstallPrompt());

  expect(result.current.event).toBeNull();
  expect(result.current.installed).toBe(false);

  let fired: Event;
  act(() => {
    fired = fireBeforeInstallPrompt();
  });

  expect(result.current.event).toBe(fired!);
  expect(result.current.installed).toBe(false);
});

test('appinstalled event clears the stashed prompt and flips installed to true', () => {
  initInstallPromptCapture();
  const { result } = renderHook(() => useInstallPrompt());

  act(() => {
    fireBeforeInstallPrompt();
  });
  expect(result.current.event).not.toBeNull();

  act(() => {
    window.dispatchEvent(new Event('appinstalled'));
  });

  expect(result.current.installed).toBe(true);
  expect(result.current.event).toBeNull();
});

test('initInstallPromptCapture is idempotent: only one window listener registered for each event', () => {
  // Spy directly because counting event fires can't distinguish duplicate listeners writing the same state.
  const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
  try {
    initInstallPromptCapture();
    initInstallPromptCapture();

    const beforePromptCount = addEventListenerSpy.mock.calls.filter(
      ([type]) => type === 'beforeinstallprompt',
    ).length;
    const appInstalledCount = addEventListenerSpy.mock.calls.filter(
      ([type]) => type === 'appinstalled',
    ).length;

    expect(beforePromptCount).toBe(1);
    expect(appInstalledCount).toBe(1);
  } finally {
    addEventListenerSpy.mockRestore();
  }
});

test('preventDefault is called on the captured event (Chromium needs it to suppress the native infobar)', () => {
  initInstallPromptCapture();

  const event = new Event('beforeinstallprompt', { cancelable: true });
  const spy = vi.spyOn(event, 'preventDefault');
  window.dispatchEvent(event);

  expect(spy).toHaveBeenCalledTimes(1);
});

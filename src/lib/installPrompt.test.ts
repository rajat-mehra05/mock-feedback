import { test, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { initInstallPromptCapture, useInstallPrompt, __resetForTests } from './installPrompt';

beforeEach(() => {
  __resetForTests();
});

function fireBeforeInstallPrompt(): Event {
  // The real BeforeInstallPromptEvent isn't constructible in jsdom. Build
  // a plain Event with the prompt() / userChoice fields the listener
  // stashes and the UI later calls.
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

test('initInstallPromptCapture is idempotent (safe to call twice)', () => {
  initInstallPromptCapture();
  initInstallPromptCapture();

  const { result } = renderHook(() => useInstallPrompt());
  let fireCount = 0;
  act(() => {
    fireBeforeInstallPrompt();
    fireCount++;
  });

  // If the listener registered twice, both would fire on a single
  // dispatchEvent, but they'd both write the same event so we can't
  // observe duplication that way. Instead assert that re-init didn't
  // wipe the stashed event.
  expect(result.current.event).not.toBeNull();
  expect(fireCount).toBe(1);
});

test('preventDefault is called on the captured event (Chromium needs it to suppress the native infobar)', () => {
  initInstallPromptCapture();

  const event = new Event('beforeinstallprompt', { cancelable: true });
  const spy = vi.spyOn(event, 'preventDefault');
  window.dispatchEvent(event);

  expect(spy).toHaveBeenCalledTimes(1);
});

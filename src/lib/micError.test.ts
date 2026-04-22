import { expect, test, vi } from 'vitest';
import { canOpenMicSettings, classifyMicError, openMicSettings, micError } from './micError';

test('browser mic failures become structured errors with kind-specific messages, and raw internal detail never leaks into user-facing copy', () => {
  const cases: Array<[string, 'permission-denied' | 'no-device' | 'device-in-use' | 'constraint']> =
    [
      ['NotAllowedError', 'permission-denied'],
      ['SecurityError', 'permission-denied'],
      ['NotFoundError', 'no-device'],
      ['DevicesNotFoundError', 'no-device'],
      ['NotReadableError', 'device-in-use'],
      ['TrackStartError', 'device-in-use'],
      ['OverconstrainedError', 'constraint'],
    ];
  for (const [name, expected] of cases) {
    const err = new DOMException('boom', name);
    const classified = classifyMicError(err);
    expect(classified.kind).toBe(expected);
    expect(classified.message.length).toBeGreaterThan(0);
  }

  // Unknown DOMException falls back to `unknown`.
  expect(classifyMicError(new DOMException('x', 'AbortError')).kind).toBe('unknown');

  // Non-DOMException exposes raw text via `detail` but keeps the generic
  // user-facing `message` so internal errors never surface in the UI.
  const fromOpaqueError = classifyMicError(new Error('specific failure message'));
  expect(fromOpaqueError.kind).toBe('unknown');
  expect(fromOpaqueError.detail).toBe('specific failure message');
  expect(fromOpaqueError.message).not.toContain('specific failure message');

  expect(classifyMicError(undefined).kind).toBe('unknown');
  expect(classifyMicError({}).kind).toBe('unknown');

  // micError honours override text.
  expect(micError('no-device', 'custom').message).toBe('custom');
});

test('"Open System Settings" opens the mic pane on macOS and Windows, and stays disabled on platforms without a reliable deep link', ({
  onTestFinished,
}) => {
  const originalUA = navigator.userAgent;
  function setUA(value: string): void {
    Object.defineProperty(navigator, 'userAgent', { value, configurable: true });
  }
  onTestFinished(() => {
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
  });

  const clicks: string[] = [];
  const anchorSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this.href);
  });
  onTestFinished(() => anchorSpy.mockRestore());

  setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)');
  expect(canOpenMicSettings()).toBe(true);
  openMicSettings();
  expect(clicks.at(-1)).toContain('x-apple.systempreferences');

  setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
  expect(canOpenMicSettings()).toBe(true);
  openMicSettings();
  expect(clicks.at(-1)).toContain('ms-settings:privacy-microphone');

  setUA('Mozilla/5.0 (X11; Linux x86_64)');
  expect(canOpenMicSettings()).toBe(false);
  const before = clicks.length;
  openMicSettings();
  expect(clicks.length).toBe(before);
});

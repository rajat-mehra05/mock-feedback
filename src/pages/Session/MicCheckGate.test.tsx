import { expect, test, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MicCheckGate } from './MicCheckGate';
import * as micCheck from '@/lib/micCheck';

function stubGetUserMedia(impl: () => Promise<MediaStream>) {
  const mediaDevices = navigator.mediaDevices ?? ({} as MediaDevices);
  const original = mediaDevices.getUserMedia?.bind(mediaDevices);
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { ...mediaDevices, getUserMedia: impl },
    configurable: true,
  });
  return () =>
    Object.defineProperty(navigator, 'mediaDevices', {
      value: original ? { ...mediaDevices, getUserMedia: original } : mediaDevices,
      configurable: true,
    });
}

test('when no audio input device is connected, the user is told to plug one in and offered a retry', async ({
  onTestFinished,
}) => {
  vi.spyOn(micCheck, 'checkMediaRecorderSupport').mockReturnValue(true);
  vi.spyOn(micCheck, 'checkMicDevices').mockResolvedValue(false);
  onTestFinished(() => {
    vi.restoreAllMocks();
  });

  render(<MicCheckGate onReady={() => {}}>children</MicCheckGate>);

  const alert = await screen.findByRole('alert');
  expect(alert.textContent ?? '').toMatch(/no microphone/i);
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  // No settings button for non-permission errors.
  expect(screen.queryByRole('button', { name: /open system settings/i })).not.toBeInTheDocument();
});

test('when mic access is blocked, the user sees an explanation and a button that opens system settings', async ({
  onTestFinished,
}) => {
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)',
    configurable: true,
  });
  vi.spyOn(micCheck, 'checkMediaRecorderSupport').mockReturnValue(true);
  vi.spyOn(micCheck, 'checkMicDevices').mockResolvedValue(true);
  vi.spyOn(micCheck, 'checkMicPermission').mockResolvedValue('denied');
  const clicks: string[] = [];
  const anchorSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push(this.href);
  });
  onTestFinished(() => {
    vi.restoreAllMocks();
    anchorSpy.mockRestore();
  });

  render(<MicCheckGate onReady={() => {}}>children</MicCheckGate>);

  const alert = await screen.findByRole('alert');
  expect(alert.textContent ?? '').toMatch(/microphone access is blocked/i);

  const settingsBtn = screen.getByRole('button', { name: /open system settings/i });
  await userEvent.click(settingsBtn);
  expect(clicks.at(-1)).toContain('x-apple.systempreferences');
});

test('user can retry after a mic problem and proceed into the interview once the mic is available', async ({
  onTestFinished,
}) => {
  vi.spyOn(micCheck, 'checkMediaRecorderSupport').mockReturnValue(true);
  const devices = vi.spyOn(micCheck, 'checkMicDevices');
  devices.mockResolvedValueOnce(false).mockResolvedValue(true);
  vi.spyOn(micCheck, 'checkMicPermission').mockResolvedValue('granted');
  onTestFinished(() => {
    vi.restoreAllMocks();
  });

  const onReady = vi.fn();
  render(<MicCheckGate onReady={onReady}>done</MicCheckGate>);

  await screen.findByRole('alert');
  await userEvent.click(screen.getByRole('button', { name: /retry/i }));

  await waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
  expect(screen.getByText('done')).toBeInTheDocument();
});

test('when another app is using the microphone, the user is told to close it and retry', async ({
  onTestFinished,
}) => {
  vi.spyOn(micCheck, 'checkMediaRecorderSupport').mockReturnValue(true);
  vi.spyOn(micCheck, 'checkMicDevices').mockResolvedValue(true);
  vi.spyOn(micCheck, 'checkMicPermission').mockResolvedValue('prompt');
  const restore = stubGetUserMedia(() =>
    Promise.reject(new DOMException('busy', 'NotReadableError')),
  );
  onTestFinished(() => {
    vi.restoreAllMocks();
    restore();
  });

  render(<MicCheckGate onReady={() => {}}>children</MicCheckGate>);

  const alert = await screen.findByRole('alert');
  expect(alert.textContent ?? '').toMatch(/in use by another app/i);
});

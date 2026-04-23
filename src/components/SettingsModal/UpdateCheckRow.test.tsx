import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { platform } from '@/platform';
import { UpdateCheckRow } from './UpdateCheckRow';

test('user checks for updates: sees "up to date", re-checks and finds a new version, clicks Download to open the release page', async () => {
  const user = userEvent.setup();
  const checkSpy = vi.spyOn(platform.updater, 'checkForUpdate').mockResolvedValueOnce(null);
  const openSpy = vi.spyOn(platform.updater, 'openReleasePage').mockResolvedValue();

  render(<UpdateCheckRow />);

  // Idle: no status message rendered yet.
  expect(screen.queryByText(/up to date/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/new version available/i)).not.toBeInTheDocument();

  // First click: adapter resolves null → "Up to date".
  await user.click(screen.getByRole('button', { name: /check for updates/i }));
  expect(checkSpy).toHaveBeenCalledTimes(1);
  expect(await screen.findByText(/up to date/i)).toBeInTheDocument();

  // Second click: adapter returns an UpdateInfo → "New version available" + Download button.
  checkSpy.mockResolvedValueOnce({
    latestVersion: '0.2.0',
    htmlUrl: 'https://github.com/example/repo/releases/tag/v0.2.0',
  });
  await user.click(screen.getByRole('button', { name: /check for updates/i }));
  expect(await screen.findByText(/new version available/i)).toBeInTheDocument();
  expect(screen.getByText('v0.2.0')).toBeInTheDocument();

  // Clicking Download hands the release URL to the adapter so the
  // platform decides how to open it (shell.open on Tauri, window.open on web).
  await user.click(screen.getByRole('button', { name: /^download$/i }));
  expect(openSpy).toHaveBeenCalledWith('https://github.com/example/repo/releases/tag/v0.2.0');

  vi.restoreAllMocks();
});

test('a failing update check surfaces an explicit error message instead of staying silent', async () => {
  const user = userEvent.setup();
  vi.spyOn(platform.updater, 'checkForUpdate').mockRejectedValue(new Error('offline'));

  render(<UpdateCheckRow />);

  await user.click(screen.getByRole('button', { name: /check for updates/i }));

  // Unlike the launch toast (silent on error), Settings must tell the
  // user that the check itself failed so "no update" isn't ambiguous.
  expect(await screen.findByText(/couldn't reach github/i)).toBeInTheDocument();

  vi.restoreAllMocks();
});

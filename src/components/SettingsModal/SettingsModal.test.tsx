import { expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SettingsModal } from './SettingsModal';
import { platform, SECRET_OPENAI_API_KEY } from '@/platform';
import { APP_NAME } from '@/constants/copy';

test('user saves a new key, sees confirmation, then removes the key', async () => {
  await platform.storage.secrets.clear(SECRET_OPENAI_API_KEY);
  await platform.storage.secrets.set(SECRET_OPENAI_API_KEY, 'sk-existing');
  const user = userEvent.setup();

  renderWithProviders(<SettingsModal open={true} onOpenChange={() => {}} />);

  expect(await screen.findByText(/key configured/i)).toBeInTheDocument();

  const input = screen.getByLabelText(/openai api key/i);
  await user.type(input, 'sk-new-key');

  await user.click(screen.getByRole('button', { name: /show api key/i }));
  expect(input).toHaveAttribute('type', 'text');
  await user.click(screen.getByRole('button', { name: /hide api key/i }));
  expect(input).toHaveAttribute('type', 'password');

  const saveButton = screen.getByRole('button', { name: /^save$/i });
  await user.click(saveButton);

  await waitFor(() => expect(screen.getByRole('button', { name: /^saved$/i })).toBeInTheDocument());

  await user.click(screen.getByRole('button', { name: /remove/i }));
  await waitFor(() => expect(screen.getByText(/no key configured/i)).toBeInTheDocument());
});

test('user without a key sees guidance message, saves a key, and guidance disappears', async () => {
  await platform.storage.secrets.clear(SECRET_OPENAI_API_KEY);
  const user = userEvent.setup();

  renderWithProviders(<SettingsModal open={true} onOpenChange={() => {}} />);

  expect(
    await screen.findByText(new RegExp(`you need an openai api key to use ${APP_NAME}`, 'i')),
  ).toBeInTheDocument();
  expect(screen.getByText(/no key configured/i)).toBeInTheDocument();

  const input = screen.getByLabelText(/openai api key/i);
  await user.type(input, 'sk-new-key');
  await user.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() =>
    expect(
      screen.queryByText(new RegExp(`you need an openai api key to use ${APP_NAME}`, 'i')),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByText(/key configured/i)).toBeInTheDocument();
});

test('user sees error message when saving key fails', async ({ onTestFinished }) => {
  await platform.storage.secrets.clear(SECRET_OPENAI_API_KEY);
  await platform.storage.secrets.set(SECRET_OPENAI_API_KEY, 'sk-existing');
  const user = userEvent.setup();
  const spy = vi
    .spyOn(platform.storage.secrets, 'set')
    .mockRejectedValueOnce(new Error('DB write failed'));
  onTestFinished(() => spy.mockRestore());

  renderWithProviders(<SettingsModal open={true} onOpenChange={() => {}} />);

  expect(await screen.findByText(/key configured/i)).toBeInTheDocument();

  const input = screen.getByLabelText(/openai api key/i);
  await user.type(input, 'sk-bad-key');
  await user.click(screen.getByRole('button', { name: /^save$/i }));

  await waitFor(() => expect(screen.getByText(/failed to save key/i)).toBeInTheDocument());
});

import { expect, test, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SettingsModal } from './SettingsModal';
import * as apiKeyDb from '@/db/apiKey/apiKey';

test('user saves a new key, sees confirmation, then removes the key', async () => {
  await apiKeyDb.deleteApiKey();
  await apiKeyDb.saveApiKey('sk-existing');
  const user = userEvent.setup();

  renderWithProviders(<SettingsModal open={true} onOpenChange={() => {}} />);

  // Key configured status visible
  expect(await screen.findByText(/key configured/i)).toBeInTheDocument();

  // Enter a new key
  const input = screen.getByLabelText(/openai api key/i);
  await user.type(input, 'sk-new-key');

  // Toggle show/hide
  await user.click(screen.getByRole('button', { name: /show api key/i }));
  expect(input).toHaveAttribute('type', 'text');
  await user.click(screen.getByRole('button', { name: /hide api key/i }));
  expect(input).toHaveAttribute('type', 'password');

  // Click Save button
  const saveButton = screen.getByRole('button', { name: /^save$/i });
  await user.click(saveButton);

  // Confirmation shown — save button changes to "Saved"
  await waitFor(() => expect(screen.getByRole('button', { name: /^saved$/i })).toBeInTheDocument());

  // Remove the key
  await user.click(screen.getByRole('button', { name: /remove/i }));
  await waitFor(() => expect(screen.getByText(/no key configured/i)).toBeInTheDocument());
});

test('user without a key sees guidance message, saves a key, and guidance disappears', async () => {
  await apiKeyDb.deleteApiKey();
  const user = userEvent.setup();

  renderWithProviders(<SettingsModal open={true} onOpenChange={() => {}} />);

  // Guidance message for no-key state
  expect(
    await screen.findByText(/you need an openai api key to use voiceround/i),
  ).toBeInTheDocument();
  expect(screen.getByText(/no key configured/i)).toBeInTheDocument();

  // Save a key
  const input = screen.getByLabelText(/openai api key/i);
  await user.type(input, 'sk-new-key');
  await user.click(screen.getByRole('button', { name: /^save$/i }));

  // Guidance gone, key configured shown
  await waitFor(() =>
    expect(
      screen.queryByText(/you need an openai api key to use voiceround/i),
    ).not.toBeInTheDocument(),
  );
  expect(screen.getByText(/key configured/i)).toBeInTheDocument();
});

test('user sees error message when saving key fails', async () => {
  await apiKeyDb.deleteApiKey();
  await apiKeyDb.saveApiKey('sk-existing');
  const user = userEvent.setup();
  vi.spyOn(apiKeyDb, 'saveApiKey').mockRejectedValueOnce(new Error('DB write failed'));

  renderWithProviders(<SettingsModal open={true} onOpenChange={() => {}} />);

  expect(await screen.findByText(/key configured/i)).toBeInTheDocument();

  const input = screen.getByLabelText(/openai api key/i);
  await user.type(input, 'sk-bad-key');
  await user.click(screen.getByRole('button', { name: /^save$/i }));

  // Error feedback shown
  await waitFor(() => expect(screen.getByText(/failed to save key/i)).toBeInTheDocument());

  vi.restoreAllMocks();
});

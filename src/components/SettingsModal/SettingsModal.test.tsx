import { expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SettingsModal } from './SettingsModal';
import { saveApiKey, deleteApiKey } from '@/db/apiKey/apiKey';

test('user saves a new key, sees confirmation, then removes the key', async () => {
  await deleteApiKey();
  await saveApiKey('sk-existing');
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

  // Confirmation shown
  await waitFor(() => expect(screen.getByText(/saved!/i)).toBeInTheDocument());

  // Remove the key
  await user.click(screen.getByRole('button', { name: /remove/i }));
  await waitFor(() => expect(screen.getByText(/no key configured/i)).toBeInTheDocument());
});

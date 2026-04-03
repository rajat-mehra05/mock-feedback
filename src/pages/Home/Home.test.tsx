import { expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Home } from './Home';
import { saveApiKey, deleteApiKey } from '@/db/apiKey/apiKey';

test('user sees disabled Start button with hint when no API key is set, then opens modal after key is configured', async () => {
  await deleteApiKey();
  const user = userEvent.setup();

  const { unmount } = renderWithProviders(<Home />);

  // Start button visible but disabled
  const startButton = screen.getByRole('button', { name: /start new interview session/i });
  expect(startButton).toBeDisabled();
  expect(screen.getByText(/configure your api key in settings/i)).toBeInTheDocument();

  // Hero content visible
  expect(screen.getByRole('heading', { name: /nail your next/i })).toBeInTheDocument();

  // Configure key — remount so the hook picks up the new key
  await saveApiKey('sk-test');
  unmount();
  renderWithProviders(<Home />);

  const enabledButton = await screen.findByRole('button', { name: /start new interview session/i });
  await waitFor(() => expect(enabledButton).toBeEnabled());
  await user.click(enabledButton);

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/welcome to mock feedback/i)).toBeInTheDocument();
});

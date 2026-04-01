import { expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Home } from './Home';
import { saveApiKey, deleteApiKey } from '@/db/apiKey/apiKey';

test('user sees disabled Start button with hint when no API key is set, then opens modal after key is configured', async () => {
  await deleteApiKey();
  const user = userEvent.setup();

  renderWithProviders(<Home />);

  // Start button visible but disabled
  const startButton = screen.getByRole('button', { name: /start new interview session/i });
  expect(startButton).toBeDisabled();
  expect(screen.getByText(/configure your api key in settings/i)).toBeInTheDocument();

  // Configure key — button becomes enabled
  await saveApiKey('sk-test');
  renderWithProviders(<Home />);

  await waitFor(() => {
    const buttons = screen.getAllByRole('button', { name: /start new interview session/i });
    const enabledButton = buttons.find((btn) => !btn.hasAttribute('disabled'));
    expect(enabledButton).toBeDefined();
  });

  const buttons = screen.getAllByRole('button', { name: /start new interview session/i });
  const enabledButton = buttons.find((btn) => !btn.hasAttribute('disabled'))!;
  await user.click(enabledButton);

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/welcome to mock feedback/i)).toBeInTheDocument();
});

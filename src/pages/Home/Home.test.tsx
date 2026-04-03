import { expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Home } from './Home';

test('user sees hero content and clicks Start to open the session modal', async () => {
  const user = userEvent.setup();

  renderWithProviders(<Home />);

  // Hero content visible
  expect(screen.getByRole('heading', { name: /nail your next/i })).toBeInTheDocument();

  // Start button is always enabled (no API key gate)
  const startButton = screen.getByRole('button', { name: /start new interview session/i });
  expect(startButton).toBeEnabled();

  // Click Start — modal opens
  await user.click(startButton);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/start a session/i)).toBeInTheDocument();
});

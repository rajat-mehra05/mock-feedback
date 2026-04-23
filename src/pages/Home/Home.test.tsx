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

  // Web build shows the desktop-download CTAs: the Install section (web-only)
  // and a footer link. Both point at the same GitHub releases URL — the
  // section is the primary path for new visitors; the footer link is a
  // fallback once they've scrolled past it.
  const desktopCtas = screen.getAllByRole('link', { name: /get the desktop app|download for/i });
  expect(desktopCtas.length).toBeGreaterThan(0);
  desktopCtas.forEach((link) => {
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/rajat-mehra05/voice-round/releases/latest',
    );
  });

  // Click Start — modal opens
  await user.click(startButton);
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/start a session/i)).toBeInTheDocument();
});

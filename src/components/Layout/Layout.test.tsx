import { expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Layout } from './Layout';

test('mobile hamburger opens dropdown with History and Settings, then closes on navigation', async () => {
  const user = userEvent.setup();

  renderWithProviders(
    <Layout>
      <p>Page content</p>
    </Layout>,
  );

  // Main content renders
  expect(screen.getByText('Page content')).toBeInTheDocument();

  // Home link in nav
  expect(screen.getByRole('link', { name: /home/i })).toBeInTheDocument();

  // Mobile menu button exists
  const menuButton = screen.getByRole('button', { name: /open menu/i });
  expect(menuButton).toBeInTheDocument();

  // Open the mobile menu
  await user.click(menuButton);

  // Button label updates to "Close menu" and aria-expanded is true
  const closeButton = screen.getByRole('button', { name: /close menu/i });
  expect(closeButton).toHaveAttribute('aria-expanded', 'true');

  // Dropdown has History link pointing to /history
  // There are two "History" elements (desktop + mobile), so grab the mobile one via getAllByRole
  const historyLinks = screen.getAllByRole('link', { name: /history/i });
  const mobileHistoryLink = historyLinks.find((el) => !el.classList.contains('group/button'))!;
  expect(mobileHistoryLink).toHaveAttribute('href', '/history');

  // Dropdown has a Settings button (mobile-specific one has w-full class)
  const allSettingsButtons = screen.getAllByText(/^settings$/i);
  const mobileSettingsButton = allSettingsButtons.find((el) => el.classList.contains('w-full'))!;
  expect(mobileSettingsButton).toBeInTheDocument();

  // Click mobile History — dropdown should close
  await user.click(mobileHistoryLink);
  expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
});

test('mobile Settings button opens SettingsModal', async () => {
  const user = userEvent.setup();

  renderWithProviders(
    <Layout>
      <p>Page content</p>
    </Layout>,
  );

  // Open mobile menu
  await user.click(screen.getByRole('button', { name: /open menu/i }));

  // Click the mobile Settings button (the one with w-full class)
  const allSettingsButtons = screen.getAllByText(/^settings$/i);
  const mobileSettingsButton = allSettingsButtons.find((el) => el.classList.contains('w-full'))!;
  await user.click(mobileSettingsButton);

  // Dropdown closes
  expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();

  // SettingsModal opens (it has an "OpenAI API Key" label)
  expect(await screen.findByLabelText(/openai api key/i)).toBeInTheDocument();
});

test('skip-to-content link and landmarks are accessible', () => {
  renderWithProviders(
    <Layout>
      <p>Content</p>
    </Layout>,
  );

  expect(screen.getByText(/skip to content/i)).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
  expect(screen.getByRole('main')).toBeInTheDocument();
});

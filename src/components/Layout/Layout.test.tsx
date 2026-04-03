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

  // Dropdown has menu with menuitem roles
  const menu = screen.getByRole('menu');
  expect(menu).toBeInTheDocument();

  const menuItems = screen.getAllByRole('menuitem');
  const historyItem = menuItems.find((el) => el.textContent === 'History')!;
  expect(historyItem).toHaveAttribute('href', '/history');

  const settingsItem = menuItems.find((el) => el.textContent === 'Settings')!;
  expect(settingsItem).toBeInTheDocument();

  // Click mobile History — dropdown should close
  await user.click(historyItem);
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

  // Click the mobile Settings menuitem
  const menuItems = screen.getAllByRole('menuitem');
  const settingsItem = menuItems.find((el) => el.textContent === 'Settings')!;
  await user.click(settingsItem);

  // SettingsModal opens (dialog makes rest of page aria-hidden, so check the dialog itself)
  expect(await screen.findByRole('dialog', { name: /settings/i })).toBeInTheDocument();
  expect(screen.getByLabelText(/openai api key/i)).toBeInTheDocument();
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

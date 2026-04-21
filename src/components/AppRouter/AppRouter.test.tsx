import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Link } from 'react-router-dom';
import { AppRouter } from './AppRouter';

test('AppRouter wraps children in BrowserRouter by default, producing clean Link hrefs', () => {
  render(
    <AppRouter>
      <Link to="/session">Start session</Link>
    </AppRouter>,
  );

  expect(screen.getByRole('link', { name: 'Start session' })).toHaveAttribute('href', '/session');
});

test('AppRouter uses HashRouter when VITE_TARGET=tauri, prefixing Link hrefs with a hash', async ({
  onTestFinished,
}) => {
  vi.stubEnv('VITE_TARGET', 'tauri');
  vi.resetModules();
  onTestFinished(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  // Re-import after resetModules so Link and AppRouter share the same
  // react-router-dom module instance (otherwise router context mismatches).
  const { AppRouter: TauriAppRouter } = await import('./AppRouter');
  const { Link: TauriLink } = await import('react-router-dom');

  render(
    <TauriAppRouter>
      <TauriLink to="/session">Start session</TauriLink>
    </TauriAppRouter>,
  );

  expect(screen.getByRole('link', { name: 'Start session' })).toHaveAttribute('href', '#/session');
});

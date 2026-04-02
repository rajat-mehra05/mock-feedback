import { expect, test, vi } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary, SessionErrorFallback } from './ErrorBoundary';

function ThrowingChild() {
  throw new Error('Boom');
}

test('child throw triggers fallback, logs error, and reload button calls window.location.reload', async () => {
  const user = userEvent.setup();
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const reloadMock = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });

  render(
    <ErrorBoundary>
      <ThrowingChild />
    </ErrorBoundary>,
  );

  // Default fallback shown
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();

  // componentDidCatch logged the error
  expect(consoleErrorSpy).toHaveBeenCalledWith(
    'ErrorBoundary caught:',
    expect.any(Error),
    expect.any(String),
  );

  // Reload button triggers window.location.reload
  await user.click(screen.getByRole('button', { name: /reload/i }));
  expect(reloadMock).toHaveBeenCalledOnce();

  vi.restoreAllMocks();
});

test('renders custom fallback when provided', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});

  render(
    <ErrorBoundary fallback={<div>Custom fallback</div>}>
      <ThrowingChild />
    </ErrorBoundary>,
  );

  expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();

  vi.restoreAllMocks();
});

test('SessionErrorFallback renders error UI with working Return Home and Try Again buttons', async () => {
  const user = userEvent.setup();
  const reloadMock = vi.fn();
  const hrefSetter = vi.fn();
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });
  Object.defineProperty(window.location, 'href', { set: hrefSetter, configurable: true });

  render(<SessionErrorFallback />);

  expect(screen.getByText(/session encountered an error/i)).toBeInTheDocument();

  // Return Home navigates to /
  await user.click(screen.getByRole('button', { name: /return home/i }));
  expect(hrefSetter).toHaveBeenCalledWith('/');

  // Try Again reloads the page
  await user.click(screen.getByRole('button', { name: /try again/i }));
  expect(reloadMock).toHaveBeenCalledOnce();

  vi.restoreAllMocks();
});

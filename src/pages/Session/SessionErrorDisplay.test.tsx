import { expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionErrorDisplay } from './SessionErrorDisplay';
import type { OpenAIServiceError } from '@/services/types';

test('error display shows retry button for retryable errors and settings link for auth errors', async () => {
  const user = userEvent.setup();
  const onRetry = vi.fn();

  // Retryable error shows retry button
  const { unmount } = render(
    <SessionErrorDisplay
      error={
        { type: 'rate_limit', message: 'Rate limited.', retryable: true } as OpenAIServiceError
      }
      onRetry={onRetry}
    />,
  );
  const retryButton = screen.getByRole('button', { name: /retry/i });
  expect(retryButton).toBeInTheDocument();
  await user.click(retryButton);
  expect(onRetry).toHaveBeenCalledOnce();
  unmount();

  // Auth error shows Settings prompt text, no retry button
  const { unmount: unmountAuth } = render(
    <SessionErrorDisplay
      error={{ type: 'auth', message: 'Invalid key.', retryable: false } as OpenAIServiceError}
      onRetry={vi.fn()}
    />,
  );
  expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
  expect(
    screen.getByText(
      (_content, element) =>
        element?.tagName === 'P' &&
        element.textContent === 'Click Settings in the header to update your API key.',
    ),
  ).toBeInTheDocument();
  unmountAuth();

  // Network error — no retry (non-retryable), no special links
  render(
    <SessionErrorDisplay
      error={
        { type: 'network', message: 'Connection lost.', retryable: false } as OpenAIServiceError
      }
      onRetry={vi.fn()}
    />,
  );
  expect(screen.getByRole('alert')).toBeInTheDocument();
  expect(screen.getByText(/connection lost/i)).toBeInTheDocument();
});

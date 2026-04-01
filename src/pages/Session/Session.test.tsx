import { expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Session } from './Session';

test('session page renders topic header and question counter from query params', () => {
  renderWithProviders(<Session />, { initialRoute: '/session?topic=react-nextjs&count=7' });

  expect(screen.getByRole('heading', { name: /react & next\.js/i })).toBeInTheDocument();
  expect(screen.getByText(/question 0 of 7/i)).toBeInTheDocument();
});

test('session page falls back to defaults for missing or invalid query params', () => {
  // No params at all — defaults to JS/TS topic and default count
  renderWithProviders(<Session />, { initialRoute: '/session' });
  expect(screen.getByRole('heading', { name: /javascript \/ typescript/i })).toBeInTheDocument();
  expect(screen.getByText(/question 0 of 5/i)).toBeInTheDocument();
});

test('session page falls back to default count for non-numeric count param', () => {
  renderWithProviders(<Session />, { initialRoute: '/session?topic=nodejs&count=abc' });

  expect(screen.getByRole('heading', { name: /node\.js/i })).toBeInTheDocument();
  expect(screen.getByText(/question 0 of 5/i)).toBeInTheDocument();
});

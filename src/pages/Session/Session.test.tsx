import { expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Session } from './Session';

test('session page renders topic header and question counter from query params', () => {
  renderWithProviders(<Session />, { initialRoute: '/session?topic=react-nextjs&count=7' });

  expect(screen.getByRole('heading', { name: /react & next\.js/i })).toBeInTheDocument();
  expect(screen.getByText(/question 0 of 7/i)).toBeInTheDocument();
});

test('session page falls back to defaults when no query params are provided', () => {
  renderWithProviders(<Session />, { initialRoute: '/session' });

  expect(screen.getByRole('heading', { name: /javascript \/ typescript/i })).toBeInTheDocument();
});

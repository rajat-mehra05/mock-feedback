import { expect, test } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Session } from './Session';

test('user sees topic header, question counter, recording indicator, and stop button', () => {
  render(
    <MemoryRouter initialEntries={['/session?topic=react-nextjs&count=7']}>
      <Session />
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: /react & next\.js/i })).toBeInTheDocument();
  expect(screen.getByText(/question 1 of 7/i)).toBeInTheDocument();
  expect(screen.getByRole('status', { name: /recording status/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /stop recording/i })).toBeInTheDocument();
  expect(screen.getByText(/max answer length.*maximum silence/i)).toBeInTheDocument();
  expect(screen.getByText(/closures/i)).toBeInTheDocument();
});

test('session page falls back to defaults when no query params are provided', () => {
  render(
    <MemoryRouter initialEntries={['/session']}>
      <Session />
    </MemoryRouter>,
  );

  // Default topic label and default question count
  expect(screen.getByRole('heading', { name: /javascript \/ typescript/i })).toBeInTheDocument();
  expect(screen.getByText(/question 1 of 5/i)).toBeInTheDocument();
});

test('session page shows raw topic value when topic key is unknown', () => {
  render(
    <MemoryRouter initialEntries={['/session?topic=unknown-topic&count=3']}>
      <Session />
    </MemoryRouter>,
  );

  expect(screen.getByRole('heading', { name: /unknown-topic/i })).toBeInTheDocument();
  expect(screen.getByText(/question 1 of 3/i)).toBeInTheDocument();
});

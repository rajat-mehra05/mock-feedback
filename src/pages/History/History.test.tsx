import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { History } from './History';
import { db } from '@/db/sessions/sessions';
import { makeSession } from '@/test/factories';

test('user sees empty state when no sessions exist', async () => {
  await db.sessions.clear();

  renderWithProviders(<History />);

  expect(await screen.findByText(/no interviews yet/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();

  const stats = screen.getByRole('region', { name: /interview statistics/i });
  expect(within(stats).getByText('0')).toBeInTheDocument();
});

test('user sees stats bar and session cards when sessions exist', async () => {
  await db.sessions.clear();

  await db.sessions.bulkAdd([
    makeSession({
      id: 's1',
      topic: 'JavaScript / TypeScript',
      createdAt: new Date('2026-03-28Z'),
      averageScore: 7.0,
    }),
    makeSession({
      id: 's2',
      topic: 'Node.js',
      createdAt: new Date('2026-03-30Z'),
      averageScore: 8.0,
    }),
  ]);

  renderWithProviders(<History />);

  // Wait for session data to load, then check stats
  await screen.findByText('JavaScript / TypeScript');
  const stats = screen.getByRole('region', { name: /interview statistics/i });
  expect(within(stats).getByText('2')).toBeInTheDocument();
  expect(within(stats).getByText('7.5')).toBeInTheDocument();

  // Session cards
  expect(screen.getAllByText('JavaScript / TypeScript')[0]).toBeInTheDocument();
  expect(screen.getAllByText('Node.js')[0]).toBeInTheDocument();

  // Go to Home button always visible
  expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
});

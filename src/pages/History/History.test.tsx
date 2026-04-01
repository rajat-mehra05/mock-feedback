import { expect, test } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/renderWithProviders';
import { History } from './History';
import { db } from '@/db/sessions/sessions';

test('user sees empty state when no sessions exist', async () => {
  await db.sessions.clear();

  renderWithProviders(<History />);

  expect(await screen.findByText(/no interviews yet/i)).toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
});

test('user sees stats bar and session cards when sessions exist', async () => {
  await db.sessions.clear();

  await db.sessions.bulkAdd([
    {
      id: 's1',
      topic: 'JavaScript / TypeScript',
      createdAt: new Date('2026-03-28'),
      duration: 600,
      questionCount: 5,
      averageScore: 7.0,
      questions: [{ id: 'q1', questionText: 'Q?', userTranscript: 'A.', rating: 7, feedback: 'OK.' }],
    },
    {
      id: 's2',
      topic: 'Node.js',
      createdAt: new Date('2026-03-30'),
      duration: 480,
      questionCount: 3,
      averageScore: 8.0,
      questions: [{ id: 'q2', questionText: 'Q?', userTranscript: 'A.', rating: 8, feedback: 'Good.' }],
    },
  ]);

  renderWithProviders(<History />);

  // Stats bar
  expect(await screen.findByText('2')).toBeInTheDocument();
  expect(screen.getByText('7.5')).toBeInTheDocument();

  // Session cards
  expect(screen.getAllByText('JavaScript / TypeScript')[0]).toBeInTheDocument();
  expect(screen.getAllByText('Node.js')[0]).toBeInTheDocument();
});

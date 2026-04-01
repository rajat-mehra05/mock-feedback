import { expect, test } from 'vitest';
import { screen, render } from '@testing-library/react';
import { Feedback } from './Feedback';
import { db } from '@/db/sessions/sessions';
import { Routes, Route } from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';

function renderFeedback(sessionId: string) {
  return render(
    <MemoryRouter initialEntries={[`/history/${sessionId}`]}>
      <Routes>
        <Route path="/history/:id" element={<Feedback />} />
      </Routes>
    </MemoryRouter>,
  );
}

test('user sees session not found for invalid id', async () => {
  await db.sessions.clear();
  renderFeedback('nonexistent');

  expect(await screen.findByText(/session not found/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /back to history/i })).toBeInTheDocument();
});

test('user sees all questions with ratings, feedback text, overall summary, and back link', async () => {
  await db.sessions.clear();

  await db.sessions.add({
    id: 'fb-session',
    topic: 'React & Next.js',
    createdAt: new Date('2026-03-30'),
    duration: 720,
    questionCount: 3,
    averageScore: 7.0,
    questions: [
      {
        id: 'q1',
        questionText: 'What is the virtual DOM?',
        userTranscript: 'An in-memory representation of the real DOM.',
        rating: 9,
        feedback: 'Excellent answer covering the diffing process.',
      },
      {
        id: 'q2',
        questionText: 'Explain React hooks rules.',
        userTranscript: 'Must be called at top level.',
        rating: 7,
        feedback: 'Good but could mention the ESLint plugin.',
      },
      {
        id: 'q3',
        questionText: 'What is prop drilling?',
        userTranscript: 'Passing props through many layers.',
        rating: 4,
        feedback: 'Too brief. Discuss Context API or state management alternatives.',
      },
    ],
  });

  renderFeedback('fb-session');

  // Questions visible
  expect(await screen.findByText('What is the virtual DOM?')).toBeInTheDocument();
  expect(screen.getByText('Explain React hooks rules.')).toBeInTheDocument();
  expect(screen.getByText('What is prop drilling?')).toBeInTheDocument();

  // Ratings visible — covers all three scoreColor branches (green >=8, yellow >=6, red <6)
  expect(screen.getByText('9/10')).toBeInTheDocument();
  expect(screen.getByText('7/10')).toBeInTheDocument();
  expect(screen.getByText('4/10')).toBeInTheDocument();

  // User transcripts visible
  expect(screen.getByText(/an in-memory representation/i)).toBeInTheDocument();
  expect(screen.getByText(/must be called at top level/i)).toBeInTheDocument();

  // Feedback text visible
  expect(screen.getByText(/excellent answer/i)).toBeInTheDocument();

  // Overall summary
  expect(screen.getByText(/overall performance summary/i)).toBeInTheDocument();
  expect(screen.getByText('7.0/10')).toBeInTheDocument();

  // Back link at bottom of page
  const backButtons = screen.getAllByRole('button', { name: /back to history/i });
  expect(backButtons.length).toBeGreaterThan(0);
});

import { expect, test } from 'vitest';
import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Feedback } from './Feedback';
import { db } from '@/db/sessions/sessions';
import { makeSession } from '@/test/factories';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

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

  await db.sessions.add(
    makeSession({
      id: 'fb-session',
      topic: 'React & Next.js',
      averageScore: 7.0,
      questionCount: 3,
      questions: [
        {
          id: 'q1',
          questionText: 'What is the virtual DOM?',
          userTranscript: 'An in-memory representation of the real DOM.',
          rating: 9,
          confidence: 'high',
          feedback: 'Excellent answer covering the diffing process.',
          modelAnswer:
            'The virtual DOM is a lightweight in-memory representation of the real DOM. React uses it to batch and diff changes, then applies only the minimal set of updates to the actual DOM, avoiding costly reflows.',
        },
        {
          id: 'q2',
          questionText: 'Explain React hooks rules.',
          userTranscript: 'Must be called at top level.',
          rating: 7,
          confidence: 'medium',
          feedback: 'Good but could mention the ESLint plugin.',
          modelAnswer:
            'Hooks must be called at the top level of a React function — never inside loops, conditions, or nested functions. This ensures the hooks call order is stable across renders. The eslint-plugin-react-hooks enforces this automatically.',
        },
        {
          id: 'q3',
          questionText: 'What is prop drilling?',
          userTranscript: 'Passing props through many layers.',
          rating: 4,
          confidence: 'low',
          feedback: 'Too brief. Discuss Context API or state management alternatives.',
          modelAnswer:
            'Prop drilling is passing data down through multiple component layers that do not themselves need it, just to reach a deeply nested child. It makes components harder to refactor and reason about. The usual solutions are React Context for simple cases, or a state manager like Zustand or Redux for more complex shared state.',
        },
      ],
    }),
  );

  renderFeedback('fb-session');

  // Questions visible
  expect(await screen.findByText('What is the virtual DOM?')).toBeInTheDocument();
  expect(screen.getByText('Explain React hooks rules.')).toBeInTheDocument();
  expect(screen.getByText('What is prop drilling?')).toBeInTheDocument();

  // Ratings visible — covers all three scoreColor branches (green >=8, yellow >=6, red <6)
  expect(screen.getByText('9/10')).toBeInTheDocument();
  expect(screen.getAllByText('7/10').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('4/10')).toBeInTheDocument();

  // User transcripts visible
  expect(screen.getByText(/an in-memory representation/i)).toBeInTheDocument();
  expect(screen.getByText(/must be called at top level/i)).toBeInTheDocument();

  // Feedback text visible
  expect(screen.getByText(/excellent answer/i)).toBeInTheDocument();

  // Confidence badges visible — covers all three tiers
  expect(screen.getByText('High Confidence')).toBeInTheDocument();
  expect(screen.getByText('Medium Confidence')).toBeInTheDocument();
  expect(screen.getByText('Low Confidence')).toBeInTheDocument();

  // Overall summary — average of 9+7+4 = 6.67, rounds to 7, same as Q2's rating
  expect(screen.getByText(/overall performance summary/i)).toBeInTheDocument();
  expect(screen.getAllByText('7/10').length).toBeGreaterThanOrEqual(2);

  // Back link at bottom of page
  const backButtons = screen.getAllByRole('button', { name: /back to history/i });
  expect(backButtons.length).toBeGreaterThan(0);
});

test('user toggles to Model Answers view and sees modelAnswer content', async () => {
  await db.sessions.clear();
  await db.sessions.add(
    makeSession({
      id: 'toggle-session',
      topic: 'JavaScript',
      averageScore: 8,
      questions: [
        {
          id: 'q1',
          questionText: 'What is a closure?',
          userTranscript: 'A function that captures scope.',
          rating: 8,
          feedback: 'Good explanation.',
          modelAnswer: 'A closure is a function that retains access to its lexical scope.',
        },
      ],
    }),
  );

  const user = userEvent.setup();
  renderFeedback('toggle-session');

  // Default view shows feedback
  expect(await screen.findByText(/good explanation/i)).toBeInTheDocument();

  // Toggle to model answers
  const trigger = screen.getByRole('combobox', { name: /view mode/i });
  await user.click(trigger);
  const modelOption = await screen.findByRole('option', { name: /good answers/i });
  await user.click(modelOption);

  // Model answer visible
  expect(await screen.findByText(/retains access to its lexical scope/i)).toBeInTheDocument();
});

import { expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { SessionCard } from './SessionCard';
import { makeSession } from '@/test/factories';

test('user sees topic, date, duration, question count, score, and card links to feedback page', () => {
  renderWithProviders(
    <SessionCard
      session={makeSession({
        id: 'card-test',
        topic: 'Node.js',
        duration: 480,
        questionCount: 3,
        averageScore: 4.0,
        questions: [
          {
            id: 'q1',
            questionText: 'How does Node handle concurrency?',
            userTranscript: 'Event loop.',
            rating: 7,
            feedback: 'Good.',
          },
        ],
      })}
    />,
  );

  expect(screen.getAllByText('Node.js')[0]).toBeInTheDocument();
  expect(screen.getByText('3 questions')).toBeInTheDocument();
  expect(screen.getByText('8m 0s')).toBeInTheDocument();
  expect(screen.getByText('4.0/10')).toBeInTheDocument();
  expect(screen.getByText(/how does node handle concurrency/i)).toBeInTheDocument();

  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', '/history/card-test');
});

test('delete button calls onDelete and card handles all score tiers and empty questions', async () => {
  const user = userEvent.setup();
  const onDelete = vi.fn();

  // Green tier (>= 8) + delete behavior
  const { unmount } = renderWithProviders(
    <SessionCard
      session={makeSession({ id: 'del-1', topic: 'React', averageScore: 9.0 })}
      onDelete={onDelete}
    />,
  );

  await user.click(screen.getByRole('button', { name: /delete react session/i }));
  expect(onDelete).toHaveBeenCalledWith('del-1');
  unmount();

  // Yellow tier (>= 6, < 8) + empty questions (firstQuestion fallback)
  renderWithProviders(<SessionCard session={makeSession({ averageScore: 7.0, questions: [] })} />);

  expect(screen.getByText('7.0/10')).toBeInTheDocument();
});

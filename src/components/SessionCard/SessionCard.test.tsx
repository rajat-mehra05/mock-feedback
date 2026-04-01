import { expect, test } from 'vitest';
import { screen, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SessionCard } from './SessionCard';
import { makeSession } from '@/test/factories';

test('user sees topic, date, duration, question count, score, and card links to feedback page', () => {
  render(
    <MemoryRouter>
      <SessionCard
        session={makeSession({
          id: 'card-test',
          topic: 'Node.js',
          duration: 480,
          questionCount: 3,
          averageScore: 7.0,
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
      />
    </MemoryRouter>,
  );

  expect(screen.getAllByText('Node.js')[0]).toBeInTheDocument();
  expect(screen.getByText('3 questions')).toBeInTheDocument();
  expect(screen.getByText('8m 0s')).toBeInTheDocument();
  expect(screen.getByText('7.0/10')).toBeInTheDocument();
  expect(screen.getByText(/how does node handle concurrency/i)).toBeInTheDocument();

  const link = screen.getByRole('link');
  expect(link).toHaveAttribute('href', '/history/card-test');
});

test('score colors reflect performance levels: green for high, yellow for mid, red for low', () => {
  const { unmount } = render(
    <MemoryRouter>
      <SessionCard session={makeSession({ averageScore: 9.0 })} />
    </MemoryRouter>,
  );
  expect(screen.getByText('9.0/10')).toHaveClass('text-green-600');
  unmount();

  const { unmount: unmount2 } = render(
    <MemoryRouter>
      <SessionCard session={makeSession({ averageScore: 6.5 })} />
    </MemoryRouter>,
  );
  expect(screen.getByText('6.5/10')).toHaveClass('text-yellow-600');
  unmount2();

  render(
    <MemoryRouter>
      <SessionCard session={makeSession({ averageScore: 4.0 })} />
    </MemoryRouter>,
  );
  expect(screen.getByText('4.0/10')).toHaveClass('text-red-600');
});

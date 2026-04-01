import { expect, test } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { Home } from './Home';
import { db } from '@/db/sessions/sessions';
import { saveApiKey, deleteApiKey } from '@/db/apiKey/apiKey';

test('user sees empty state and disabled Start button when no API key is set', async () => {
  await db.sessions.clear();
  await deleteApiKey();

  renderWithProviders(<Home />);

  expect(await screen.findByText(/your past interview sessions will appear here/i)).toBeInTheDocument();

  const startButton = screen.getByRole('button', { name: /start new interview session/i });
  expect(startButton).toBeDisabled();

  expect(screen.getByText(/configure your api key in settings/i)).toBeInTheDocument();
});

test('user can click Start to open modal when API key is configured', async () => {
  await db.sessions.clear();
  await deleteApiKey();
  await saveApiKey('sk-test');
  const user = userEvent.setup();

  renderWithProviders(<Home />);

  // Wait for API key to load and button to become enabled
  await waitFor(() => {
    const buttons = screen.getAllByRole('button', { name: /start new interview session/i });
    const enabledButton = buttons.find((btn) => !btn.hasAttribute('disabled'));
    expect(enabledButton).toBeDefined();
  });

  const buttons = screen.getAllByRole('button', { name: /start new interview session/i });
  const enabledButton = buttons.find((btn) => !btn.hasAttribute('disabled'))!;
  await user.click(enabledButton);

  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText(/welcome to mock feedback/i)).toBeInTheDocument();
});

test('user sees session cards when sessions exist in the database', async () => {
  await db.sessions.clear();
  await deleteApiKey();
  await saveApiKey('sk-test');

  await db.sessions.add({
    id: 'test-1',
    topic: 'React & Next.js',
    createdAt: new Date('2026-03-30'),
    duration: 720,
    questionCount: 5,
    averageScore: 8.0,
    questions: [{
      id: 'q1',
      questionText: 'What is React?',
      userTranscript: 'A UI library.',
      rating: 8,
      feedback: 'Good.',
    }],
  });

  renderWithProviders(<Home />);

  expect(await screen.findByText('React & Next.js')).toBeInTheDocument();
  expect(screen.getByText('8.0/10')).toBeInTheDocument();
});

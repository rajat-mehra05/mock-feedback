import { expect, test } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { History } from './History';
import { platform } from '@/platform';
import { makeSession } from '@/test/factories';

async function seedSessions(sessions: ReturnType<typeof makeSession>[]): Promise<void> {
  await platform.storage.sessions.deleteAll();
  for (const s of sessions) {
    await platform.storage.sessions.create(s);
  }
}

test('user sees empty state when no sessions exist', async () => {
  await platform.storage.sessions.deleteAll();

  renderWithProviders(<History />);

  expect(await screen.findByText(/no interviews yet/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();

  const stats = screen.getByRole('region', { name: /interview statistics/i });
  expect(within(stats).getByText('0')).toBeInTheDocument();
});

test('user sees stats bar and session cards when sessions exist', async () => {
  await seedSessions([
    makeSession({
      id: 's1',
      topic: 'JavaScript & TypeScript',
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

  await screen.findByText('JavaScript & TypeScript');
  const stats = screen.getByRole('region', { name: /interview statistics/i });
  expect(within(stats).getByText('2')).toBeInTheDocument();
  expect(within(stats).getByText('8')).toBeInTheDocument();

  expect(screen.getAllByText('JavaScript & TypeScript')[0]).toBeInTheDocument();
  expect(screen.getAllByText('Node.js')[0]).toBeInTheDocument();

  expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
});

test('Delete All opens a confirmation dialog, keeps sessions on cancel, clears on confirm', async () => {
  await seedSessions([
    makeSession({ id: 'del-1', topic: 'React' }),
    makeSession({ id: 'del-2', topic: 'Node.js' }),
  ]);
  const user = userEvent.setup();

  renderWithProviders(<History />);

  const deleteButton = await screen.findByRole('button', { name: /delete all/i });

  await user.click(deleteButton);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: /cancel/i }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(2);

  await user.click(screen.getByRole('button', { name: /delete all/i }));
  const dialog = await screen.findByRole('dialog');
  await user.click(within(dialog).getByRole('button', { name: /delete all/i }));
  expect(await screen.findByText(/no interviews yet/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /delete all/i })).not.toBeInTheDocument();
});

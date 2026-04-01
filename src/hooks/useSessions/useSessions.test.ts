import { expect, test } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { db, createSession } from '@/db/sessions/sessions';
import { makeSession } from '@/test/factories';
import { useSessions } from './useSessions';

test('useSessions loads sessions, removes one, and removes all', async () => {
  await db.sessions.clear();
  await createSession(makeSession({ id: 's1', topic: 'React', createdAt: new Date('2026-03-28') }));
  await createSession(
    makeSession({ id: 's2', topic: 'Node.js', createdAt: new Date('2026-03-30') }),
  );

  const { result } = renderHook(() => useSessions());

  // Initially loading, then resolves with sessions ordered by createdAt desc
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.sessions).toHaveLength(2);
  expect(result.current.sessions[0].id).toBe('s2');
  expect(result.current.sessions[1].id).toBe('s1');

  // Remove a single session
  await result.current.removeSession('s1');
  await waitFor(() => expect(result.current.sessions).toHaveLength(1));
  expect(result.current.sessions[0].id).toBe('s2');

  // Add another session back, then remove all
  await createSession(makeSession({ id: 's3', topic: 'JS' }));
  result.current.refresh();
  await waitFor(() => expect(result.current.sessions).toHaveLength(2));

  await result.current.removeAll();
  await waitFor(() => expect(result.current.sessions).toHaveLength(0));
});

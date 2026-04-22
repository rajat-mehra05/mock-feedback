import { expect, test, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { db, createSession } from '@/platform/storage/sessionsDexie';
import { makeSession } from '@/test/factories';
import { useSessions } from './useSessions';
import { platform } from '@/platform';

test('useSessions loads sessions, removes one, and removes all', async () => {
  await db.sessions.clear();
  await createSession(makeSession({ id: 's1', topic: 'React', createdAt: new Date('2026-03-28') }));
  await createSession(
    makeSession({ id: 's2', topic: 'Node.js', createdAt: new Date('2026-03-30') }),
  );

  const { result } = renderHook(() => useSessions());

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.sessions).toHaveLength(2);
  expect(result.current.sessions[0].id).toBe('s2');
  expect(result.current.sessions[1].id).toBe('s1');

  await result.current.removeSession('s1');
  await waitFor(() => expect(result.current.sessions).toHaveLength(1));
  expect(result.current.sessions[0].id).toBe('s2');

  await createSession(makeSession({ id: 's3', topic: 'JS' }));
  result.current.refresh();
  await waitFor(() => expect(result.current.sessions).toHaveLength(2));

  await result.current.removeAll();
  await waitFor(() => expect(result.current.sessions).toHaveLength(0));
});

test('useSessions handles storage failure gracefully', async ({ onTestFinished }) => {
  const spy = vi
    .spyOn(platform.storage.sessions, 'getAll')
    .mockRejectedValueOnce(new Error('DB corrupted'));
  onTestFinished(() => spy.mockRestore());

  const { result } = renderHook(() => useSessions());

  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.sessions).toEqual([]);
});

import { expect, test } from 'vitest';
import { db, createSession, getSession, getAllSessions, deleteSession } from './sessions';
import { makeSession } from '@/test/factories';

test('full session CRUD lifecycle: create, read, list ordering, update, and delete', async () => {
  await db.sessions.clear();

  // Create sessions
  await createSession(makeSession({ id: 'older', createdAt: new Date('2026-03-01') }));
  await createSession(makeSession({ id: 'newer', createdAt: new Date('2026-03-30') }));
  await createSession(makeSession({ id: 'middle', createdAt: new Date('2026-03-15') }));

  // Read single session
  const session = await getSession('older');
  expect(session).toBeDefined();
  expect(session!.topic).toBe('JavaScript & TypeScript');
  expect(session!.questions).toHaveLength(1);

  // Read non-existent session returns undefined
  expect(await getSession('does-not-exist')).toBeUndefined();

  // List returns all sessions ordered by createdAt descending
  const all = await getAllSessions();
  expect(all).toHaveLength(3);
  expect(all[0].id).toBe('newer');
  expect(all[1].id).toBe('middle');
  expect(all[2].id).toBe('older');

  // Delete removes the session
  await deleteSession('middle');
  const remaining = await getAllSessions();
  expect(remaining).toHaveLength(2);
  expect(remaining.map((s) => s.id)).toEqual(['newer', 'older']);

  // Empty state after clearing
  await db.sessions.clear();
  expect(await getAllSessions()).toHaveLength(0);
});

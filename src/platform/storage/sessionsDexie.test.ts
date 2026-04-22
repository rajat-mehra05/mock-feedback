import { expect, test } from 'vitest';
import { db, createSession, getSession, getAllSessions, deleteSession } from './sessionsDexie';
import { makeSession } from '@/test/factories';

test('session lifecycle: create, read, list ordering, and delete', async () => {
  await db.sessions.clear();

  await createSession(makeSession({ id: 'older', createdAt: new Date('2026-03-01') }));
  await createSession(makeSession({ id: 'newer', createdAt: new Date('2026-03-30') }));
  await createSession(makeSession({ id: 'middle', createdAt: new Date('2026-03-15') }));

  const session = await getSession('older');
  expect(session).toBeDefined();
  expect(session!.topic).toBe('JavaScript & TypeScript');
  expect(session!.questions).toHaveLength(1);

  expect(await getSession('does-not-exist')).toBeUndefined();

  const all = await getAllSessions();
  expect(all).toHaveLength(3);
  expect(all[0].id).toBe('newer');
  expect(all[1].id).toBe('middle');
  expect(all[2].id).toBe('older');

  await deleteSession('middle');
  const remaining = await getAllSessions();
  expect(remaining).toHaveLength(2);
  expect(remaining.map((s) => s.id)).toEqual(['newer', 'older']);

  await db.sessions.clear();
  expect(await getAllSessions()).toHaveLength(0);
});

import { expect, test } from 'vitest';
import { db, createSession, getSession, getAllSessions, deleteSession } from './sessions';
import { makeSession } from '@/test/factories';

test('createSession stores a session and getSession retrieves it', async () => {
  await db.sessions.clear();
  const session = makeSession();
  await createSession(session);

  const retrieved = await getSession('test-session-1');
  expect(retrieved).toBeDefined();
  expect(retrieved!.topic).toBe('JavaScript / TypeScript');
  expect(retrieved!.questionCount).toBe(3);
  expect(retrieved!.questions).toHaveLength(1);
  expect(retrieved!.questions[0].rating).toBe(8);
});

test('getAllSessions returns sessions ordered by createdAt descending', async () => {
  await db.sessions.clear();
  await createSession(makeSession({ id: 'older', createdAt: new Date('2026-03-01') }));
  await createSession(makeSession({ id: 'newer', createdAt: new Date('2026-03-30') }));
  await createSession(makeSession({ id: 'middle', createdAt: new Date('2026-03-15') }));

  const sessions = await getAllSessions();
  expect(sessions).toHaveLength(3);
  expect(sessions[0].id).toBe('newer');
  expect(sessions[1].id).toBe('middle');
  expect(sessions[2].id).toBe('older');
});

test('deleteSession removes the session and getAllSessions reflects the change', async () => {
  await db.sessions.clear();
  await createSession(makeSession({ id: 'to-keep' }));
  await createSession(makeSession({ id: 'to-delete' }));

  await deleteSession('to-delete');

  const remaining = await getAllSessions();
  expect(remaining).toHaveLength(1);
  expect(remaining[0].id).toBe('to-keep');

  const deleted = await getSession('to-delete');
  expect(deleted).toBeUndefined();
});

test('getSession returns undefined for non-existent id', async () => {
  await db.sessions.clear();
  const result = await getSession('does-not-exist');
  expect(result).toBeUndefined();
});

test('getAllSessions returns empty array when no sessions exist', async () => {
  await db.sessions.clear();
  const sessions = await getAllSessions();
  expect(sessions).toHaveLength(0);
});

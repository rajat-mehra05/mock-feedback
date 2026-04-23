import { expect, test, vi, afterEach } from 'vitest';
import { db, createSession, getSession, getAllSessions, deleteSession } from './sessionsDexie';
import { makeSession } from '@/test/factories';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

test('createSession evicts the oldest session when storage is over 80% quota', async () => {
  await db.sessions.clear();

  // Pre-fill with three sessions of ascending ages.
  await db.sessions.add(makeSession({ id: 'oldest', createdAt: new Date('2026-01-01') }));
  await db.sessions.add(makeSession({ id: 'middle', createdAt: new Date('2026-02-01') }));
  await db.sessions.add(makeSession({ id: 'newer', createdAt: new Date('2026-03-01') }));

  // Stub navigator.storage.estimate to report 95% usage.
  vi.stubGlobal('navigator', {
    ...navigator,
    storage: {
      estimate: vi.fn().mockResolvedValue({ usage: 95, quota: 100 }),
      persist: vi.fn().mockResolvedValue(false),
    },
  });

  await createSession(makeSession({ id: 'incoming', createdAt: new Date('2026-04-01') }));

  const ids = (await getAllSessions()).map((s) => s.id).sort();
  expect(ids).toEqual(['incoming', 'middle', 'newer']);
  // 'oldest' was evicted to make room for 'incoming'.

  await db.sessions.clear();
});

test('createSession does NOT evict when usage is below 80% quota', async () => {
  await db.sessions.clear();
  await db.sessions.add(makeSession({ id: 'pre-existing', createdAt: new Date('2026-01-01') }));

  vi.stubGlobal('navigator', {
    ...navigator,
    storage: {
      estimate: vi.fn().mockResolvedValue({ usage: 30, quota: 100 }),
      persist: vi.fn().mockResolvedValue(false),
    },
  });

  await createSession(makeSession({ id: 'incoming', createdAt: new Date('2026-02-01') }));

  const all = await getAllSessions();
  expect(all).toHaveLength(2);

  await db.sessions.clear();
});

test('createSession tolerates a missing navigator.storage API (falls through cleanly)', async () => {
  await db.sessions.clear();

  vi.stubGlobal('navigator', { userAgent: 'no-storage-api-test' });

  await expect(
    createSession(makeSession({ id: 'works-anyway', createdAt: new Date('2026-01-01') })),
  ).resolves.toBeUndefined();

  await db.sessions.clear();
});

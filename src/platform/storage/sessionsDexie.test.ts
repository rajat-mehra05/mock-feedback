import { expect, test, vi, afterEach } from 'vitest';
import { db, createSession, getSession, getAllSessions, deleteSession } from './sessionsDexie';
import { makeSession } from '@/test/factories';

// Explicit clear keeps file readable; setup.ts also clears globally.
afterEach(async () => {
  await db.sessions.clear();
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
});

test('createSession evicts the oldest session when storage is over 80% quota', async () => {
  await db.sessions.clear();

  await db.sessions.add(makeSession({ id: 'oldest', createdAt: new Date('2026-01-01') }));
  await db.sessions.add(makeSession({ id: 'middle', createdAt: new Date('2026-02-01') }));
  await db.sessions.add(makeSession({ id: 'newer', createdAt: new Date('2026-03-01') }));

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
});

test('createSession tolerates a missing navigator.storage API (falls through cleanly)', async () => {
  await db.sessions.clear();

  vi.stubGlobal('navigator', { userAgent: 'no-storage-api-test' });

  await expect(
    createSession(makeSession({ id: 'works-anyway', createdAt: new Date('2026-01-01') })),
  ).resolves.toBeUndefined();
});

test('post-write eviction never deletes the just-created session even if it has the smallest createdAt', async () => {
  // Backdated incoming session must not be evicted by its own post-write quota check.
  await db.sessions.clear();
  await db.sessions.add(makeSession({ id: 'newer1', createdAt: new Date('2026-03-01') }));
  await db.sessions.add(makeSession({ id: 'newer2', createdAt: new Date('2026-04-01') }));

  vi.stubGlobal('navigator', {
    ...navigator,
    storage: {
      estimate: vi.fn().mockResolvedValue({ usage: 95, quota: 100 }),
      persist: vi.fn().mockResolvedValue(false),
    },
  });

  const session = makeSession({ id: 'incoming-but-oldest', createdAt: new Date('2025-01-01') });
  await createSession(session);

  expect(await getSession(session.id)).toBeDefined();
  const remainingIds = (await getAllSessions()).map((s) => s.id).sort();
  expect(remainingIds).toContain(session.id);
});

test('createSession on an empty DB with high quota inserts cleanly without eviction errors', async () => {
  // Empty DB + high quota: eviction should no-op (no oldest row), not crash.
  await db.sessions.clear();

  vi.stubGlobal('navigator', {
    ...navigator,
    storage: {
      estimate: vi.fn().mockResolvedValue({ usage: 95, quota: 100 }),
      persist: vi.fn().mockResolvedValue(false),
    },
  });

  const session = makeSession({ id: 'first-and-only', createdAt: new Date('2026-01-01') });
  await expect(createSession(session)).resolves.toBeUndefined();
  expect(await getSession(session.id)).toBeDefined();
});

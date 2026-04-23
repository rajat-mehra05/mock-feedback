import Dexie, { type EntityTable } from 'dexie';
import type { Session } from '../types';

const db = new Dexie('VoiceRoundDB') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
};

db.version(1).stores({
  sessions: 'id, topic, createdAt',
});

// PWA.0: defensive eviction. Add-then-evict-on-quota keeps the data
// the user already has unless the in-flight add itself succeeds. The
// previous evict-then-add risked losing the oldest session if the
// subsequent add failed for any reason (including non-quota errors
// like a transaction abort).
//
// `navigator.storage.estimate()` is widely supported (Chromium 75+,
// Safari 17+, Firefox 57+). On browsers without it the post-write
// proactive eviction is skipped — the QuotaExceededError catch path
// is the last line of defence regardless.

const QUOTA_EVICTION_THRESHOLD = 0.8;

async function shouldEvictForQuota(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return false;
  let estimate: StorageEstimate;
  try {
    estimate = await navigator.storage.estimate();
  } catch {
    return false;
  }
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  if (quota === 0) return false;
  return usage / quota >= QUOTA_EVICTION_THRESHOLD;
}

async function evictOldestSession(): Promise<void> {
  // Inside a transaction so a concurrent createSession can't delete the
  // same row twice or race the orderBy().first() lookup.
  await db.transaction('rw', db.sessions, async () => {
    const oldest = await db.sessions.orderBy('createdAt').first();
    if (oldest) await db.sessions.delete(oldest.id);
  });
}

function isQuotaExceeded(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // DOMException types vary by browser. Match by name and by message
  // substring so the known shapes (Chromium, Safari, Firefox, IDB
  // wrappers) are all caught.
  const name = (err as { name?: string }).name ?? '';
  if (name === 'QuotaExceededError') return true;
  if (name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  return /quota/i.test(err.message);
}

export async function createSession(session: Session): Promise<void> {
  // 1. Try the add first. Common path succeeds without touching
  //    older sessions, so evict-then-fail can't corrupt history.
  try {
    await db.sessions.add(session);
  } catch (err) {
    // 2. On QuotaExceededError, drop the oldest session and retry the
    //    add exactly once. Other errors propagate; they aren't quota
    //    issues this code can fix.
    if (isQuotaExceeded(err)) {
      await evictOldestSession();
      await db.sessions.add(session);
    } else {
      throw err;
    }
  }

  // 3. Post-write quota check: if usage is now >=80% of quota, drop
  //    the oldest session to make room for the next write. The
  //    eviction is a single delete so the latency cost is trivial.
  //    Tolerates missing/throwing storage.estimate on browsers that
  //    don't support it.
  try {
    if (await shouldEvictForQuota()) await evictOldestSession();
  } catch {
    /* eviction is best-effort */
  }
}

export async function getSession(id: string): Promise<Session | undefined> {
  return db.sessions.get(id);
}

export async function getAllSessions(): Promise<Session[]> {
  return db.sessions.orderBy('createdAt').reverse().toArray();
}

export async function deleteSession(id: string): Promise<void> {
  return db.sessions.delete(id);
}

export async function deleteAllSessions(): Promise<void> {
  await db.sessions.clear();
}

export { db };

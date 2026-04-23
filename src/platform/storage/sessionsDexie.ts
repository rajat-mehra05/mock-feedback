import Dexie, { type EntityTable } from 'dexie';
import type { Session } from '../types';

const db = new Dexie('VoiceRoundDB') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
};

db.version(1).stores({
  sessions: 'id, topic, createdAt',
});

// PWA.0: defensive eviction before write. If the origin's storage quota
// is already near full, db.sessions.add can fail with QuotaExceededError
// and the user loses both the in-flight session and any prior session
// that triggers a transaction abort. Cheaper to evict the oldest session
// ourselves before that happens. The 80% threshold leaves headroom for
// the new session's own write plus the index update.
//
// `navigator.storage.estimate()` is widely supported (Chromium 75+,
// Safari 17+, Firefox 57+). On browsers that don't expose it we skip the
// check rather than throwing — the underlying QuotaExceededError path
// still exists as the last line of defence.
async function evictIfNearQuota(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return;
  let estimate: StorageEstimate;
  try {
    estimate = await navigator.storage.estimate();
  } catch {
    return;
  }
  const usage = estimate.usage ?? 0;
  const quota = estimate.quota ?? 0;
  if (quota === 0) return;
  if (usage / quota < 0.8) return;
  // At >=80% usage, drop the oldest session. Old sessions are the most
  // expendable item in storage (the user can't undo deleting them but
  // the in-flight one is more important to preserve).
  const oldest = await db.sessions.orderBy('createdAt').first();
  if (oldest) await db.sessions.delete(oldest.id);
}

export async function createSession(session: Session): Promise<void> {
  await evictIfNearQuota();
  await db.sessions.add(session);
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

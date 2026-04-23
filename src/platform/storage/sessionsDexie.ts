import Dexie, { type EntityTable } from 'dexie';
import type { Session } from '../types';

const db = new Dexie('VoiceRoundDB') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
};

db.version(1).stores({
  sessions: 'id, topic, createdAt',
});

// PWA.0: add-then-evict-on-quota; previous evict-first risked losing oldest if add failed.
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

// Drop oldest session; exemptSessionId guards against deleting a backdated just-inserted row.
async function evictOldestSession(exemptSessionId?: string): Promise<void> {
  await db.transaction('rw', db.sessions, async () => {
    const oldest = await db.sessions.orderBy('createdAt').first();
    if (!oldest) return;
    if (exemptSessionId && oldest.id === exemptSessionId) return;
    await db.sessions.delete(oldest.id);
  });
}

function isQuotaExceeded(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // DOMException name varies across browsers + IDB wrappers; match by name and message.
  const name = (err as { name?: string }).name ?? '';
  if (name === 'QuotaExceededError') return true;
  if (name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  return /quota/i.test(err.message);
}

export async function createSession(session: Session): Promise<void> {
  try {
    await db.sessions.add(session);
  } catch (err) {
    // Quota retry: evict + add in one transaction so the delete rolls back if the retry add fails.
    if (isQuotaExceeded(err)) {
      await db.transaction('rw', db.sessions, async () => {
        const oldest = await db.sessions.orderBy('createdAt').first();
        if (oldest && oldest.id !== session.id) {
          await db.sessions.delete(oldest.id);
        }
        await db.sessions.add(session);
      });
    } else {
      throw err;
    }
  }

  // Post-write proactive eviction; exempt the just-inserted row in case it has the smallest createdAt.
  try {
    if (await shouldEvictForQuota()) await evictOldestSession(session.id);
  } catch {
    /* best-effort */
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

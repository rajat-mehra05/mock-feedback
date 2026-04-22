import Dexie, { type EntityTable } from 'dexie';
import type { Session } from '../types';

const db = new Dexie('VoiceRoundDB') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
};

db.version(1).stores({
  sessions: 'id, topic, createdAt',
});

export async function createSession(session: Session): Promise<string> {
  return db.sessions.add(session);
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

import Dexie, { type EntityTable } from 'dexie';

export interface Question {
  id: string;
  questionText: string;
  userTranscript: string;
  rating: number;
  feedback: string;
  followUp?: string;
}

export interface Session {
  id: string;
  topic: string;
  createdAt: Date;
  duration: number;
  questionCount: number;
  averageScore: number;
  questions: Question[];
}

const db = new Dexie('MockFeedbackDB') as Dexie & {
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

export async function updateSession(
  id: string,
  changes: Partial<Omit<Session, 'id'>>,
): Promise<void> {
  await db.sessions.update(id, changes);
}

export async function deleteSession(id: string): Promise<void> {
  return db.sessions.delete(id);
}

export async function deleteAllSessions(): Promise<void> {
  await db.sessions.clear();
}

export { db };

import { db } from '@/db/sessions/sessions';
import { mockSessions } from './mockData';
import { mockSessionsExtra } from './mockDataExtra';

export async function seedMockData(): Promise<void> {
  const count = await db.sessions.count();
  if (count > 0) return;
  await db.sessions.bulkAdd([...mockSessions, ...mockSessionsExtra]);
}

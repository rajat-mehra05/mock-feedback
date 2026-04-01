import { expect, test } from 'vitest';
import { db } from '@/db/sessions/sessions';
import { seedMockData } from './seed';

test('seedMockData populates sessions and does not duplicate on second call', async () => {
  await db.sessions.clear();
  expect(await db.sessions.count()).toBe(0);

  await seedMockData();
  const count = await db.sessions.count();
  expect(count).toBe(4);

  // Calling again should not duplicate
  await seedMockData();
  expect(await db.sessions.count()).toBe(4);

  // Verify session structure
  const sessions = await db.sessions.toArray();
  const topics = sessions.map((s) => s.topic);
  expect(topics).toContain('JavaScript / TypeScript');
  expect(topics).toContain('React & Next.js');
  expect(topics).toContain('Behavioral / STAR');
  expect(topics).toContain('Node.js');

  // Verify questions exist on each session
  for (const session of sessions) {
    expect(session.questions.length).toBeGreaterThan(0);
    expect(session.averageScore).toBeGreaterThan(0);
  }
});

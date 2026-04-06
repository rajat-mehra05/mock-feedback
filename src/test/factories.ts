import type { Session } from '@/db/sessions/sessions';

export function makeSession(overrides: Partial<Session> = {}): Session {
  const questions = overrides.questions ?? [
    {
      id: 'q1',
      questionText: 'What is a closure?',
      userTranscript: 'A closure captures variables from outer scope.',
      rating: 8,
      feedback: 'Good explanation.',
    },
  ];

  return {
    id: 'test-session-1',
    topic: 'JavaScript & TypeScript',
    createdAt: new Date('2026-03-28T10:00:00Z'),
    duration: 600,
    questionCount: questions.length,
    averageScore: 7.5,
    questions,
    ...overrides,
  };
}

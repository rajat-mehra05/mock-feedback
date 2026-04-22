import type { Session } from '@/platform';

export function makeSession(overrides: Partial<Session> = {}): Session {
  const questions = overrides.questions ?? [
    {
      id: 'q1',
      questionText: 'What is a closure?',
      userTranscript:
        'A closure is when a function retains access to its outer scope even after the outer function has finished executing. ' +
        'For example, if I have a counter function that returns an increment function, the increment function still has access to the count variable. ' +
        'I use this a lot in React for things like event handlers that need to capture the current state value, and also for debounce or throttle utilities where you need to hold a timer reference between calls.',
      rating: 8,
      feedback:
        'Strong answer. Correctly identified scope retention after execution and backed it with two practical examples. ' +
        'Loses points for not mentioning that closures capture references rather than values, which is the source of most closure-related bugs.',
      modelAnswer:
        'A closure is the combination of a function and the lexical environment in which it was declared. ' +
        'When a function is defined, it captures a reference to its surrounding scope — not a snapshot of values at that moment. ' +
        '\n\nExample answer 1 (conceptual): "A closure lets an inner function read and write variables from its enclosing scope even after the outer function has returned. ' +
        'The classic example is a counter — makeCounter returns an increment function that still has exclusive access to count, which is effectively private state." ' +
        '\n\nExample answer 2 (practical): "I rely on closures constantly. Every React useCallback or event handler is a closure over the current render\'s props and state. ' +
        'Debounce and throttle implementations close over a timer ID so the cancel logic can always reach it." ' +
        '\n\nExample answer 3 (pitfalls): "The most common bug is closing over a var in a loop — all iterations share the same binding, so every callback sees the final value. ' +
        'let fixes this because it creates a new binding per iteration. Another subtle issue is unintentional memory retention: a closure keeps its entire scope chain alive, ' +
        'so a long-lived closure can prevent GC of large objects if you\'re not careful."',
    },
  ];

  return {
    id: 'test-session-1',
    topic: 'JavaScript & TypeScript',
    createdAt: new Date('2026-03-28T10:00:00Z'),
    duration: 600,
    questionCount: questions.length,
    averageScore: 7.5,
    summary:
      'Solid foundational knowledge. Focus on explaining the "why" behind concepts and connecting answers to real-world scenarios to push scores higher.',
    questions,
    ...overrides,
  };
}

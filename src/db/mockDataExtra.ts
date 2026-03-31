import type { Session } from './index';

export const mockSessionsExtra: Session[] = [
  {
    id: 'session-3',
    topic: 'Behavioral / STAR',
    createdAt: new Date('2026-03-31T09:00:00'),
    duration: 960,
    questionCount: 3,
    averageScore: 6.7,
    questions: [
      {
        id: 'q3-1',
        questionText: 'Tell me about a time you had to deal with a difficult team member.',
        userTranscript:
          'At my last job there was a developer who would often dismiss other people ideas in code reviews. I talked to them privately and explained how it was affecting the team. We agreed on a more constructive review process and things improved after that.',
        rating: 7,
        feedback:
          'Good use of the STAR framework with a clear situation, action, and result. To strengthen: quantify the impact and mention what you learned from the experience.',
      },
      {
        id: 'q3-2',
        questionText: 'Describe a project where you had to meet a tight deadline.',
        userTranscript:
          'We had to launch a new feature in two weeks instead of the planned month. I broke the work into must-haves and nice-to-haves, assigned tasks based on team strengths, and we delivered the core feature on time.',
        rating: 7,
        feedback:
          'Clear prioritization approach. You demonstrated leadership and pragmatic decision-making. Improve by naming the specific feature and discussing obstacles encountered.',
      },
      {
        id: 'q3-3',
        questionText: 'How do you handle receiving critical feedback?',
        userTranscript:
          'I try to listen without being defensive. I ask clarifying questions to make sure I understand the feedback correctly. Then I make a plan to address it.',
        rating: 6,
        feedback:
          'The approach is sound but the answer is too generic. Use a specific example where you received critical feedback, what it was about, and what concrete changes you made.',
      },
    ],
  },
  {
    id: 'session-4',
    topic: 'Node.js',
    createdAt: new Date('2026-04-01T08:00:00'),
    duration: 600,
    questionCount: 3,
    averageScore: 7.0,
    questions: [
      {
        id: 'q4-1',
        questionText:
          'How does Node.js handle concurrency despite being single-threaded?',
        userTranscript:
          'Node uses an event-driven non-blocking I/O model. Heavy I/O operations are offloaded to the system kernel or the libuv thread pool, and the main thread processes callbacks when they complete.',
        rating: 8,
        feedback:
          'Strong answer. You correctly identified the event-driven model, non-blocking I/O, and libuv. To improve, mention the event loop phases and how worker_threads can be used for CPU-intensive tasks.',
      },
      {
        id: 'q4-2',
        questionText: 'What are streams in Node.js and why are they useful?',
        userTranscript:
          'Streams let you process data in chunks instead of loading everything into memory at once. There are readable, writable, duplex, and transform streams.',
        rating: 7,
        feedback:
          'Good overview of stream types and their memory efficiency benefit. Consider giving a concrete example like piping a file read stream to an HTTP response.',
      },
      {
        id: 'q4-3',
        questionText:
          'How would you handle errors in an Express middleware chain?',
        userTranscript:
          'You create an error handling middleware with four parameters: err, req, res, next. You place it at the end of the middleware chain.',
        rating: 6,
        feedback:
          'Correct basics but incomplete. Discuss express-async-errors, centralized error formatting, and how to avoid leaking stack traces in production.',
      },
    ],
  },
];

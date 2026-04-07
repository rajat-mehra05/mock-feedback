export const TOPIC_GROUPS = [
  {
    category: 'Languages & Runtimes',
    topics: [
      { value: 'javascript-typescript', label: 'JavaScript & TypeScript' },
      { value: 'python', label: 'Python' },
      { value: 'go', label: 'Go' },
      { value: 'java', label: 'Java' },
      { value: 'rust', label: 'Rust' },
    ],
  },
  {
    category: 'Frameworks',
    topics: [
      { value: 'react-nextjs', label: 'React & Next.js' },
      { value: 'nodejs', label: 'Node.js' },
      { value: 'fastapi-django', label: 'FastAPI & Django' },
    ],
  },
  {
    category: 'Concepts',
    topics: [
      { value: 'system-design-frontend', label: 'System Design (Frontend)' },
      { value: 'system-design-backend', label: 'System Design (Backend)' },
      { value: 'system-design-fullstack', label: 'System Design (Full-Stack)' },
      { value: 'docker-kubernetes', label: 'Docker & Kubernetes' },
      { value: 'aws-cloud', label: 'AWS & Cloud' },
      { value: 'graphql', label: 'GraphQL' },
    ],
  },
  {
    category: 'Behavioral',
    topics: [{ value: 'behavioral', label: 'Behavioral & STAR' }],
  },
] as const;

/** Literal union of all topic values — derived from the const declaration. */
export type TopicValue = (typeof TOPIC_GROUPS)[number]['topics'][number]['value'];

/** Flat list of all topics — derived from groups. */
export const TOPICS: readonly { value: TopicValue; label: string }[] = TOPIC_GROUPS.flatMap((g) => [
  ...g.topics,
]);

export const TOPIC_LABELS = Object.fromEntries(TOPICS.map((t) => [t.value, t.label])) as Record<
  TopicValue,
  string
>;

export const QUESTION_COUNTS = [5, 7, 10] as const;

export const DEFAULT_QUESTION_COUNT = '5';

export const DEFAULT_TOPIC: TopicValue = 'javascript-typescript';

const VALID_TOPICS = new Set<TopicValue>(TOPICS.map((t) => t.value));

export function toValidTopic(raw: string | null): TopicValue {
  const value = raw ?? DEFAULT_TOPIC;
  return VALID_TOPICS.has(value as TopicValue) ? (value as TopicValue) : DEFAULT_TOPIC;
}

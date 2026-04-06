export const TOPICS = [
  { value: 'javascript-typescript', label: 'JavaScript & TypeScript' },
  { value: 'react-nextjs', label: 'React & Next.js' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'behavioral', label: 'Behavioral & STAR' },
] as const;

export const TOPIC_LABELS: Record<string, string> = {
  'javascript-typescript': 'JavaScript & TypeScript',
  'react-nextjs': 'React & Next.js',
  nodejs: 'Node.js',
  behavioral: 'Behavioral & STAR',
};

export const QUESTION_COUNTS = [5, 7, 10] as const;

export const DEFAULT_QUESTION_COUNT = '5';

type TopicValue = (typeof TOPICS)[number]['value'];

const VALID_TOPICS: Set<string> = new Set(TOPICS.map((t) => t.value));

export function toValidTopic(raw: string | null): TopicValue {
  const value = raw ?? 'javascript-typescript';
  return VALID_TOPICS.has(value) ? (value as TopicValue) : 'javascript-typescript';
}

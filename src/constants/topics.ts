export const TOPICS = [
  { value: 'javascript-typescript', label: 'JavaScript / TypeScript' },
  { value: 'react-nextjs', label: 'React & Next.js' },
  { value: 'nodejs', label: 'Node.js' },
  { value: 'behavioral', label: 'Behavioral / STAR' },
] as const;

export const TOPIC_LABELS: Record<string, string> = {
  'javascript-typescript': 'JavaScript / TypeScript',
  'react-nextjs': 'React & Next.js',
  nodejs: 'Node.js',
  behavioral: 'Behavioral / STAR',
};

export const QUESTION_COUNTS = [3, 5, 7, 10] as const;

export const DEFAULT_QUESTION_COUNT = '5';

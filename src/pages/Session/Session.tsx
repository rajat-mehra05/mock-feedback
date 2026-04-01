import { useSearchParams } from 'react-router-dom';
import { TOPIC_LABELS, DEFAULT_QUESTION_COUNT } from '@/constants/topics';
import { RECORDING_RULES } from '@/constants/copy';

const MOCK_QUESTIONS = [
  'Can you explain how closures work in JavaScript and give a practical example of when you would use one?',
  'What is the difference between var, let, and const? When would you choose each?',
];

export function Session() {
  const [searchParams] = useSearchParams();
  const topic = searchParams.get('topic') ?? 'javascript-typescript';
  const count = searchParams.get('count') ?? DEFAULT_QUESTION_COUNT;
  const topicLabel = TOPIC_LABELS[topic] ?? topic;

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <header className="w-full text-center">
        <h1 className="text-xl font-bold text-foreground">{topicLabel}</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Question 1 of {count}
        </p>
      </header>

      <section className="w-full max-w-2xl space-y-4" aria-label="Interview conversation">
        {MOCK_QUESTIONS.slice(0, 1).map((question, i) => (
          <div
            key={i}
            className="rounded-lg border border-border bg-muted/50 p-4"
            role="status"
            aria-label={`AI question ${i + 1}`}
          >
            <p className="mb-1 text-xs font-medium text-muted-foreground">AI Interviewer</p>
            <p className="text-foreground">{question}</p>
          </div>
        ))}
      </section>

      <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
        <div
          className="flex h-4 w-4 rounded-full bg-red-500 motion-safe:animate-pulse"
          aria-label="Recording in progress"
        />
        <p className="text-xs text-muted-foreground">Recording your answer...</p>
        <p className="text-xs text-muted-foreground">{RECORDING_RULES}</p>
      </div>

      <button
        aria-label="Stop recording"
        className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-600 text-sm font-bold text-white shadow-lg transition-colors hover:bg-violet-700 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 motion-safe:active:scale-95"
      >
        Stop
      </button>
    </div>
  );
}

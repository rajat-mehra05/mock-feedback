import { useRef, useEffect } from 'react';
import type { ConversationTurn } from '@/services/types';

interface ConversationLogProps {
  history: ConversationTurn[];
  currentQuestion: string | null;
  ttsFallbackText: string | null;
}

export function ConversationLog({
  history,
  currentQuestion,
  ttsFallbackText,
}: ConversationLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history.length, currentQuestion]);

  const displayedQuestion = currentQuestion ?? ttsFallbackText;

  return (
    <section className="w-full max-w-2xl space-y-3" aria-label="Interview conversation">
      {history.map((turn, i) => (
        <div key={i} className="space-y-2">
          <div
            className="rounded-lg border border-border bg-muted/50 p-3"
            aria-label={`Question ${i + 1}`}
          >
            <p className="mb-1 text-xs font-medium text-muted-foreground">AI Interviewer</p>
            <p className="text-sm text-foreground">{turn.question}</p>
          </div>
          <div
            className="rounded-lg border border-border bg-primary/5 p-3"
            aria-label={`Your answer ${i + 1}`}
          >
            <p className="mb-1 text-xs font-medium text-muted-foreground">You</p>
            <p className="text-sm text-foreground">{turn.answer}</p>
          </div>
        </div>
      ))}
      {displayedQuestion && (
        <div
          className="rounded-lg border border-border bg-muted/50 p-3"
          role="status"
          aria-label="Current question"
        >
          <p className="mb-1 text-xs font-medium text-muted-foreground">AI Interviewer</p>
          <p className="text-sm text-foreground">{displayedQuestion}</p>
        </div>
      )}
      <div ref={bottomRef} />
    </section>
  );
}

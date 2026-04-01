interface SessionHeaderProps {
  topicLabel: string;
  currentIndex: number;
  totalCount: number;
}

export function SessionHeader({ topicLabel, currentIndex, totalCount }: SessionHeaderProps) {
  return (
    <header className="w-full text-center">
      <h1 className="text-xl font-bold text-foreground">{topicLabel}</h1>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Question {currentIndex} of {totalCount}
      </p>
    </header>
  );
}

import { Link } from 'react-router-dom';
import { Trash2Icon } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { scoreColor, scoreBg } from '@/lib/score';
import type { Session } from '@/platform';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

interface SessionCardProps {
  session: Session;
  onDelete?: (id: string) => void;
}

export function SessionCard({ session, onDelete }: SessionCardProps) {
  const firstQuestion = session.questions[0]?.questionText ?? '';

  return (
    <article className="group/article relative">
      <Link
        to={`/history/${session.id}`}
        className="block focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        aria-label={`View feedback for ${session.topic} interview on ${formatDate(session.createdAt)}`}
      >
        <Card className="gap-4 transition-all duration-200 group-hover/article:-translate-y-1 group-hover/article:shadow-neo-lg">
          <CardHeader className="px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate">{session.topic}</CardTitle>
                <p className="mt-1 text-xs font-bold text-black/50">
                  {formatDate(session.createdAt)}
                </p>
              </div>
              <div
                className={`flex shrink-0 items-baseline border-2 px-2.5 py-1.5 shadow-[2px_2px_0px_0px_#000] ${scoreBg(session.averageScore)}`}
              >
                <span
                  className={`text-lg font-bold leading-tight ${scoreColor(session.averageScore)}`}
                >
                  {Math.round(session.averageScore)}/10
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-6">
            {firstQuestion && (
              <blockquote className="border-l-4 border-black pl-3 text-sm font-medium leading-relaxed text-black/70">
                {firstQuestion}
              </blockquote>
            )}
          </CardContent>

          <CardFooter className="gap-3 px-6 text-xs font-bold text-black/60">
            <span>{session.questionCount} questions</span>
            <span aria-hidden="true" className="text-black/30">
              |
            </span>
            <span>{formatDuration(session.duration)}</span>
          </CardFooter>
        </Card>
      </Link>
      {onDelete ? (
        <button
          onClick={() => onDelete(session.id)}
          aria-label={`Delete ${session.topic} session`}
          className="absolute bottom-3 right-3 flex h-11 w-11 cursor-pointer items-center justify-center border-2 border-black bg-neo-accent text-black shadow-[2px_2px_0px_0px_#000] transition-all duration-100 group-hover/article:-translate-y-1 hover:brightness-90 focus-visible:ring-2 focus-visible:ring-black sm:bottom-4 sm:right-6 sm:h-7 sm:w-7"
        >
          <Trash2Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
      ) : null}
    </article>
  );
}

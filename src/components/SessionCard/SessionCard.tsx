import { Link } from 'react-router-dom';
import { Trash2Icon } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Session } from '@/db/sessions/sessions';

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

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-700';
  if (score >= 6) return 'text-yellow-700';
  return 'text-red-700';
}

function scoreBg(score: number): string {
  if (score >= 8) return 'bg-green-200 border-black';
  if (score >= 6) return 'bg-yellow-200 border-black';
  return 'bg-red-200 border-black';
}

interface SessionCardProps {
  session: Session;
  onDelete?: (id: string) => void;
}

export function SessionCard({ session, onDelete }: SessionCardProps) {
  const firstQuestion = session.questions[0]?.questionText ?? '';

  return (
    <article className="group/article relative h-full">
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(session.id);
          }}
          aria-label={`Delete ${session.topic} session`}
          className="absolute -top-3 -right-3 z-10 flex h-8 w-8 cursor-pointer items-center justify-center border-2 border-black bg-neo-accent text-black opacity-0 shadow-[2px_2px_0px_0px_#000] transition-opacity duration-100 hover:brightness-90 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-black group-hover/article:opacity-100"
        >
          <Trash2Icon className="h-4 w-4" />
        </button>
      )}
      <Link
        to={`/history/${session.id}`}
        className="group/link block h-full focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
        aria-label={`View feedback for ${session.topic} interview on ${formatDate(session.createdAt)}`}
      >
        <Card className="h-full transition-all duration-200 group-hover/link:-translate-y-1 group-hover/link:shadow-neo-lg">
          <CardHeader>
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

          <CardContent className="flex-1">
            {firstQuestion && (
              <blockquote className="border-l-4 border-black pl-3 text-sm font-medium leading-relaxed text-black/70">
                {firstQuestion}
              </blockquote>
            )}
          </CardContent>

          <CardFooter className="gap-3 text-xs font-bold text-black/60">
            <Badge variant="secondary">{session.topic.split(' ')[0]}</Badge>
            <span className="ml-auto">{session.questionCount} questions</span>
            <span aria-hidden="true" className="text-black/30">
              |
            </span>
            <span>{formatDuration(session.duration)}</span>
          </CardFooter>
        </Card>
      </Link>
    </article>
  );
}

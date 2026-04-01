import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  hour: 'numeric',
  minute: '2-digit',
});

function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-600';
  if (score >= 6) return 'text-yellow-600';
  return 'text-red-600';
}

export function SessionCard({ session }: { session: Session }) {
  const firstQuestion = session.questions[0]?.questionText ?? '';

  return (
    <article>
      <Link to={`/history/${session.id}`} className="block">
        <Card className="motion-safe:transition-shadow hover:shadow-md">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base">{session.topic}</CardTitle>
              <Badge variant="secondary">{session.topic.split(' ')[0]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(session.createdAt)}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="line-clamp-2 text-sm text-muted-foreground">{firstQuestion}</p>
            <div className="flex items-center justify-between text-sm">
              <div className="flex gap-3 text-muted-foreground">
                <span>{session.questionCount} questions</span>
                <span>{formatDuration(session.duration)}</span>
              </div>
              <span className={`font-semibold ${scoreColor(session.averageScore)}`}>
                {session.averageScore.toFixed(1)}/10
              </span>
            </div>
            <p className="text-xs font-medium text-primary">View detailed Feedback →</p>
          </CardContent>
        </Card>
      </Link>
    </article>
  );
}

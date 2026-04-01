import { Link } from 'react-router-dom';
import { SessionCard } from '@/components/SessionCard/SessionCard';
import { Button } from '@/components/ui/button';
import { useSessions } from '@/hooks/useSessions/useSessions';

const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function History() {
  const { sessions, isLoading } = useSessions();

  const totalInterviews = sessions.length;
  const avgScore =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.averageScore, 0) / sessions.length
      : 0;
  const lastDate = sessions.length > 0 ? sessions[0].createdAt : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">My Interview History</h1>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/" />}>
          Back to Home
        </Button>
      </div>

      <div
        role="region"
        aria-label="Interview statistics"
        className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-muted/30 p-4"
      >
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">{totalInterviews}</p>
          <p className="text-xs text-muted-foreground">Interviews</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">
            {avgScore > 0 ? avgScore.toFixed(1) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">Avg Score</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-foreground">
            {lastDate ? shortDateFormatter.format(lastDate) : '—'}
          </p>
          <p className="text-xs text-muted-foreground">Last Interview</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sessions...</p>
      ) : sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center">
          <p className="text-lg text-muted-foreground">No interviews yet</p>
          <p className="text-sm text-muted-foreground">
            Start a mock interview to see your history here
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SessionCard } from '@/components/SessionCard/SessionCard';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSessions } from '@/hooks/useSessions/useSessions';

const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function History() {
  const { sessions, isLoading, removeSession, removeAll } = useSessions();
  const [isDeleting, setIsDeleting] = useState(false);

  const totalInterviews = sessions.length;
  const avgScore =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + s.averageScore, 0) / sessions.length
      : 0;
  const lastDate = sessions.length > 0 ? sessions[0].createdAt : null;

  async function handleSessionDelete(id: string) {
    try {
      await removeSession(id);
    } catch {
      // removeSession triggers a refresh via useSessions — if it fails, the card stays visible
    }
  }

  async function handleDeleteAll() {
    if (!window.confirm('Delete all interview sessions? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await removeAll();
    } catch {
      // removeAll triggers a refresh via useSessions — if it fails, the UI will still show sessions
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold uppercase tracking-tight text-black">Past Sessions</h1>
        <div className="flex gap-2">
          {sessions.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleDeleteAll()}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete All'}
            </Button>
          )}
          <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/" />}>
            Back to Home
          </Button>
        </div>
      </div>

      <div role="region" aria-label="Interview statistics" className="grid grid-cols-3 gap-4">
        <div className="border-4 border-black bg-neo-secondary p-4 text-center shadow-neo-sm">
          <p className="text-3xl font-bold text-black">{totalInterviews}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-black/70">Interviews</p>
        </div>
        <div className="border-4 border-black bg-neo-muted p-4 text-center shadow-neo-sm">
          <p className="text-3xl font-bold text-black">
            {avgScore > 0 ? avgScore.toFixed(1) : '—'}
          </p>
          <p className="text-xs font-bold uppercase tracking-widest text-black/70">Avg Score</p>
        </div>
        <div className="border-4 border-black bg-neo-accent p-4 text-center shadow-neo-sm">
          <p className="text-3xl font-bold text-black">
            {lastDate ? shortDateFormatter.format(lastDate) : '—'}
          </p>
          <p className="text-xs font-bold uppercase tracking-widest text-black/70">
            Last Interview
          </p>
        </div>
      </div>

      {isLoading ? (
        <Spinner message="Loading sessions..." />
      ) : sessions.length === 0 ? (
        <div className="border-4 border-dashed border-black bg-neo-muted/20 p-12 text-center">
          <p className="text-lg font-bold text-black">No interviews yet</p>
          <p className="text-sm font-bold text-black/60">
            Start a mock interview to see your history here
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onDelete={(id) => void handleSessionDelete(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

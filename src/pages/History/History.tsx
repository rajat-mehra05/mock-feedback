import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SessionCard } from '@/components/SessionCard/SessionCard';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useSessions } from '@/hooks/useSessions/useSessions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { trackEvent } from '@/lib/analytics';

const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function History() {
  const { sessions, isLoading, removeSession, removeAll } = useSessions();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    void trackEvent('history_viewed');
  }, []);

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
              onClick={() => setConfirmOpen(true)}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete All'}
            </Button>
          )}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent showCloseButton={false}>
              <DialogHeader>
                <DialogTitle>Delete all sessions?</DialogTitle>
                <DialogDescription>
                  This will permanently remove all {sessions.length} interview session
                  {sessions.length !== 1 ? 's' : ''}. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={isDeleting}
                  onClick={() => {
                    setConfirmOpen(false);
                    void handleDeleteAll();
                  }}
                >
                  Delete All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link to="/" />}>
            Back to Home
          </Button>
        </div>
      </div>

      <div
        role="region"
        aria-label="Interview statistics"
        className="grid grid-cols-2 gap-4 sm:grid-cols-3"
      >
        <div className="border-4 border-black bg-neo-secondary p-4 text-center shadow-neo-sm">
          <p className="text-3xl font-bold text-black">{totalInterviews}</p>
          <p className="text-xs font-bold uppercase tracking-widest text-black/70">Interviews</p>
        </div>
        <div className="border-4 border-black bg-neo-muted p-4 text-center shadow-neo-sm">
          <p className="text-3xl font-bold text-black">
            {avgScore > 0 ? Math.round(avgScore) : '—'}
          </p>
          <p className="text-xs font-bold uppercase tracking-widest text-black/70">Avg Score</p>
        </div>
        <div className="col-span-2 border-4 border-black bg-neo-accent p-4 text-center shadow-neo-sm sm:col-span-1">
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
        <div className="grid gap-6 lg:grid-cols-2">
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

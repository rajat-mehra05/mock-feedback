import { useState } from 'react';
import { StartModal } from '@/components/StartModal';
import { SessionCard } from '@/components/SessionCard';
import { useApiKey } from '@/hooks/useApiKey';
import { useSessions } from '@/hooks/useSessions';
import { RECENT_SESSIONS_LIMIT } from '@/constants/session';
import { EMPTY_SESSIONS_MESSAGE, NO_API_KEY_MESSAGE } from '@/constants/copy';

export function Home() {
  const [startOpen, setStartOpen] = useState(false);
  const { hasKey } = useApiKey();
  const { sessions, isLoading } = useSessions();

  const recentSessions = sessions.slice(0, RECENT_SESSIONS_LIMIT);

  return (
    <div className="flex flex-col items-center gap-8 py-8">
      <section className="w-full" aria-labelledby="recent-sessions-heading">
        <h2 id="recent-sessions-heading" className="mb-4 text-lg font-semibold text-foreground">
          Recent Sessions
        </h2>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading sessions...</p>
        ) : recentSessions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
            <p className="text-muted-foreground">
              {EMPTY_SESSIONS_MESSAGE}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentSessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </section>

      <div className="flex flex-col items-center gap-4">
        <div className="relative" title={!hasKey ? 'Configure your API key in Settings first' : ''}>
          <button
            onClick={() => setStartOpen(true)}
            disabled={!hasKey}
            aria-label="Start new interview session"
            className="flex h-28 w-28 items-center justify-center rounded-full bg-green-500 text-lg font-bold text-white shadow-lg transition-all hover:bg-green-600 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-green-500 disabled:hover:shadow-lg disabled:active:scale-100"
          >
            Start
          </button>
        </div>

        {!hasKey && (
          <p className="text-sm text-muted-foreground">
            {NO_API_KEY_MESSAGE}
          </p>
        )}
      </div>

      <StartModal open={startOpen} onOpenChange={setStartOpen} />
    </div>
  );
}

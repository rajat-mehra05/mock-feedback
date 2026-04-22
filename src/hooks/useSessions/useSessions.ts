import { useState, useEffect, useCallback } from 'react';
import { platform, type Session } from '@/platform';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    platform.storage.sessions.getAll().then(
      (data) => {
        if (!cancelled) {
          setSessions(data);
          setIsLoading(false);
        }
      },
      () => {
        if (!cancelled) {
          setSessions([]);
          setIsLoading(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const removeSession = useCallback(async (id: string) => {
    await platform.storage.sessions.delete(id);
    setRefreshKey((k) => k + 1);
  }, []);

  const removeAll = useCallback(async () => {
    await platform.storage.sessions.deleteAll();
    setRefreshKey((k) => k + 1);
  }, []);

  return { sessions, isLoading, refresh, removeSession, removeAll };
}

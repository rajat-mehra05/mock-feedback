import { useState, useEffect } from 'react';
import { getAllSessions, type Session } from '@/db/sessions/sessions';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAllSessions()
      .then((data) => setSessions(data))
      .catch(() => setSessions([]))
      .finally(() => setIsLoading(false));
  }, []);

  return { sessions, isLoading };
}

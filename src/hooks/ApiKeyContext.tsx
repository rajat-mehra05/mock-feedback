import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { getApiKey, saveApiKey, deleteApiKey } from '@/db/apiKey';
import { ApiKeyContext } from '@/hooks/apiKeyState';

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getApiKey()
      .then((key) => setApiKey(key))
      .catch(() => setApiKey(null))
      .finally(() => setIsLoading(false));
  }, []);

  const save = useCallback(async (key: string) => {
    await saveApiKey(key);
    setApiKey(key);
  }, []);

  const remove = useCallback(async () => {
    await deleteApiKey();
    setApiKey(null);
  }, []);

  return (
    <ApiKeyContext.Provider value={{ apiKey, hasKey: !!apiKey, isLoading, save, remove }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

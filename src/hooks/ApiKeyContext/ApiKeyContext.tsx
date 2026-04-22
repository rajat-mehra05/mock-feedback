import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { platform, SECRET_OPENAI_API_KEY } from '@/platform';
import { ApiKeyContext } from '@/hooks/ApiKeyContext/apiKeyState';

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [hasKey, setHasKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    platform.storage.secrets
      .has(SECRET_OPENAI_API_KEY)
      .then(setHasKey)
      .catch(() => setHasKey(false))
      .finally(() => setIsLoading(false));
  }, []);

  const save = useCallback(async (key: string) => {
    await platform.storage.secrets.set(SECRET_OPENAI_API_KEY, key);
    setHasKey(true);
  }, []);

  const remove = useCallback(async () => {
    await platform.storage.secrets.clear(SECRET_OPENAI_API_KEY);
    setHasKey(false);
  }, []);

  return (
    <ApiKeyContext.Provider value={{ hasKey, isLoading, save, remove }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

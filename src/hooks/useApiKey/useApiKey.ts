import { useContext } from 'react';
import { ApiKeyContext, type ApiKeyState } from '@/hooks/ApiKeyContext/apiKeyState';

export function useApiKey(): ApiKeyState {
  const ctx = useContext(ApiKeyContext);
  if (!ctx) throw new Error('useApiKey must be used within ApiKeyProvider');
  return ctx;
}

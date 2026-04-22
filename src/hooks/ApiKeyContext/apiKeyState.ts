import { createContext } from 'react';

export interface ApiKeyState {
  hasKey: boolean;
  isLoading: boolean;
  save: (key: string) => Promise<void>;
  remove: () => Promise<void>;
}

export const ApiKeyContext = createContext<ApiKeyState | null>(null);

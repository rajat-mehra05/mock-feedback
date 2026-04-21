import { invoke } from '@tauri-apps/api/core';
import { SECRET_OPENAI_API_KEY, type Platform } from '../types';

function requireOpenAIKey(key: string): void {
  if (key !== SECRET_OPENAI_API_KEY) {
    throw new Error(`unknown secret key: ${key}`);
  }
}

export const tauriPlatform: Platform = {
  target: 'tauri',
  storage: {
    secrets: {
      async set(key, value) {
        requireOpenAIKey(key);
        await invoke('secret_set', { key, value });
      },
      async has(key) {
        requireOpenAIKey(key);
        return invoke<boolean>('secret_has', { key });
      },
      async clear(key) {
        requireOpenAIKey(key);
        await invoke('secret_clear', { key });
      },
    },
  },
  analytics: {
    // Desktop stays silent per Phase 6. No-op rather than stub.
    track: () => Promise.resolve(),
  },
  http: {},
};

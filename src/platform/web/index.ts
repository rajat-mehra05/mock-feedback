import { deleteApiKey, getApiKey, saveApiKey } from '@/db/apiKey/apiKey';
import { trackEvent } from '@/lib/analytics';
import { SECRET_OPENAI_API_KEY, type Platform } from '../types';

function requireOpenAIKey(key: string): void {
  if (key !== SECRET_OPENAI_API_KEY) {
    throw new Error(`Unknown secret key: ${key}`);
  }
}

export const webPlatform: Platform = {
  target: 'web',
  storage: {
    secrets: {
      async set(key, value) {
        requireOpenAIKey(key);
        await saveApiKey(value);
      },
      async has(key) {
        requireOpenAIKey(key);
        return (await getApiKey()) !== null;
      },
      async clear(key) {
        requireOpenAIKey(key);
        await deleteApiKey();
      },
    },
  },
  analytics: {
    track: trackEvent,
  },
  http: {},
};

import { track } from '@vercel/analytics';
import { deleteApiKey, getApiKey, saveApiKey } from '../storage/apiKeyIndexedDb';
import {
  createSession,
  deleteAllSessions,
  deleteSession,
  getAllSessions,
  getSession,
} from '../storage/sessionsDexie';
import {
  getCandidateName,
  getOrCreateDeviceId,
  saveCandidateName,
} from '../storage/preferencesDexie';
import { makeWebOpenAIHttp } from './http/openai';
import { SECRET_OPENAI_API_KEY, type Platform } from '../types';

function requireOpenAIKey(key: string): void {
  if (key !== SECRET_OPENAI_API_KEY) {
    throw new Error(`Unknown secret key: ${key}`);
  }
}

// Cache the in-flight promise, not just the resolved value — concurrent
// callers (two analytics events fired during boot) must all await the same
// `getOrCreateDeviceId` call, otherwise they race and each generates and
// persists a distinct UUID.
let deviceIdPromise: Promise<string> | null = null;
function ensureDeviceId(): Promise<string> {
  if (!deviceIdPromise) {
    deviceIdPromise = getOrCreateDeviceId();
  }
  return deviceIdPromise;
}

const webHttpOpenAI = makeWebOpenAIHttp(getApiKey);

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
    sessions: {
      create: createSession,
      get: getSession,
      getAll: getAllSessions,
      delete: deleteSession,
      deleteAll: deleteAllSessions,
    },
    preferences: {
      saveCandidateName,
      getCandidateName,
      getOrCreateDeviceId,
    },
  },
  analytics: {
    async track(name, props) {
      try {
        const deviceId = await ensureDeviceId();
        track(name, { ...props, deviceId });
      } catch {
        // Analytics must never break the app.
      }
    },
  },
  http: {
    openai: webHttpOpenAI.adapter,
  },
};

/** Test-only: drop caches owned by the web adapter. */
export function _resetWebPlatformForTests(): void {
  deviceIdPromise = null;
  webHttpOpenAI.clearCache();
}

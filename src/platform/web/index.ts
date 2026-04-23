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

// Best-effort durability nudge; Chromium may prompt, Safari silently rejects.
// Must be called from a user gesture for the Chromium prompt to fire.
async function requestStoragePersistence(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  try {
    await navigator.storage.persist();
  } catch {
    /* swallow — best effort */
  }
}

// Cache the in-flight promise so concurrent boot callers share one UUID generation.
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
        // Fire-and-forget; persist() can prompt for seconds and the key save shouldn't wait.
        void requestStoragePersistence();
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
  logger: {
    info: (message, ...extras) => console.info(message, ...extras),
    warn: (message, ...extras) => console.warn(message, ...extras),
    error: (message, ...extras) => console.error(message, ...extras),
  },
  updater: {
    // Web is served, not installed — there's nothing to update.
    checkForUpdate: () => Promise.resolve(null),
    openReleasePage: (url) => {
      window.open(url, '_blank', 'noopener');
      return Promise.resolve();
    },
  },
};

/** Test-only: drop caches owned by the web adapter. */
export function _resetWebPlatformForTests(): void {
  deviceIdPromise = null;
  webHttpOpenAI.clearCache();
}

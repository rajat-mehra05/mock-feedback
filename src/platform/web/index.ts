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

/**
 * Best-effort: ask the browser to mark IndexedDB as persistent so it
 * survives storage pressure eviction. Chromium prompts the user (or
 * silently grants based on engagement). Safari almost always returns
 * false — that's a no-op, not an error to surface. We deliberately
 * don't gate the secret save on the result: a failed persist() request
 * shouldn't block the user from saving their key.
 *
 * The first call must be triggered from a user gesture (e.g. clicking
 * Save in the SettingsModal) to make the Chromium prompt fire reliably.
 * Calling it from a useEffect or a background task may silently no-op.
 */
async function requestStoragePersistence(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
  try {
    await navigator.storage.persist();
  } catch {
    /* swallow — best effort */
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
        // After the user has committed a key, it's worth telling the
        // browser to keep this origin's IndexedDB around even under
        // storage pressure. Safari ignores this; Chromium grants it
        // for installed PWAs and many regular sites.
        await requestStoragePersistence();
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

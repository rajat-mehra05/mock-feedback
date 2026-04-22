import { invoke } from '@tauri-apps/api/core';
import { error as logError, info as logInfo, warn as logWarn } from '@tauri-apps/plugin-log';
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
import { tauriOpenAIHttp } from './http/openai';
import { tauriUpdater } from './updater';
import { SECRET_OPENAI_API_KEY, type Platform } from '../types';

/** Serialise arbitrary log extras (objects, Errors, classified error
 *  payloads) down to a single string — `@tauri-apps/plugin-log` only takes
 *  a string message. Falls back to `String(x)` for non-serialisable values
 *  so a bad extra can't throw out of the logger itself. */
function stringifyExtras(extras: unknown[]): string {
  return extras
    .map((x) => {
      if (x instanceof Error) return `${x.name}: ${x.message}\n${x.stack ?? ''}`;
      try {
        return typeof x === 'string' ? x : JSON.stringify(x);
      } catch {
        return String(x);
      }
    })
    .join(' ');
}

function format(message: string, extras: unknown[]): string {
  return extras.length === 0 ? message : `${message} ${stringifyExtras(extras)}`;
}

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
    // Desktop stays silent per Phase 6. No-op rather than stub.
    track: () => Promise.resolve(),
  },
  http: {
    openai: tauriOpenAIHttp,
  },
  logger: {
    info: (message, ...extras) => {
      void logInfo(format(message, extras));
    },
    warn: (message, ...extras) => {
      void logWarn(format(message, extras));
    },
    error: (message, ...extras) => {
      void logError(format(message, extras));
    },
  },
  updater: tauriUpdater,
};

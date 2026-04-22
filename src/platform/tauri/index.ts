import { invoke } from '@tauri-apps/api/core';
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
};

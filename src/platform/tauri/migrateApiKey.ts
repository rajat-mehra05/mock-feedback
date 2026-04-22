import { invoke } from '@tauri-apps/api/core';
import { deleteApiKey, getApiKey } from '../storage/apiKeyIndexedDb';
import { SECRET_OPENAI_API_KEY } from '../types';

const MARKER_KEY = 'secrets_migrated_v1';

/**
 * One-time migration from the web-era IndexedDB key store to the OS keychain.
 * Skips silently if already migrated. Never clears IndexedDB unless the
 * keychain write is verified via `secret_has` — losing the user's BYOK key
 * is the worst possible failure for a BYOK app.
 */
export async function migrateIndexedDbKeyToKeychain(): Promise<void> {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(MARKER_KEY)) {
    return;
  }

  const existing = await getApiKey();
  if (!existing) {
    markDone();
    return;
  }

  try {
    await invoke('secret_set', { key: SECRET_OPENAI_API_KEY, value: existing });
    const has = await invoke<boolean>('secret_has', { key: SECRET_OPENAI_API_KEY });
    if (!has) {
      // Verification failed — leave IndexedDB untouched, retry next launch.
      return;
    }
    await deleteApiKey();
    markDone();
  } catch {
    // Keychain unavailable or locked. Leave IndexedDB as-is so the user
    // still has a usable key on the Tauri side (the HTTP adapter on Tauri
    // will fail until the keychain accepts a write). No data loss.
  }
}

function markDone(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(MARKER_KEY, '1');
  }
}

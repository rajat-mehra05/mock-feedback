import { invoke } from '@tauri-apps/api/core';
import { deleteApiKey, getApiKey } from '../storage/apiKeyIndexedDb';
import { SECRET_OPENAI_API_KEY } from '../types';

const MARKER_KEY = 'secrets_migrated_v1';

function readMarker(): boolean {
  try {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem(MARKER_KEY);
  } catch {
    return false;
  }
}

function writeMarker(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MARKER_KEY, '1');
  } catch {
    // localStorage can throw under sandboxed or quota-exceeded conditions.
    // Worst case, we retry the migration next launch — idempotent.
  }
}

/**
 * One-time migration from the web-era IndexedDB key store to the OS keychain.
 * Skips silently if already migrated. Never clears IndexedDB unless the
 * keychain write is verified via `secret_has` — losing the user's BYOK key
 * is the worst possible failure for a BYOK app.
 *
 * All storage calls are wrapped so that an IndexedDB / localStorage / keychain
 * failure can never abort app boot.
 */
export async function migrateIndexedDbKeyToKeychain(): Promise<void> {
  if (readMarker()) return;

  let existing: string | null = null;
  try {
    existing = await getApiKey();
  } catch {
    // IndexedDB unavailable (private mode, corrupted store, transient Dexie
    // init race at boot). Do NOT set the marker — if the failure is transient
    // we'd orphan the user's legacy key on the next successful launch.
    // Retry-next-launch is cheap; data loss is not.
    return;
  }

  if (!existing) {
    writeMarker();
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
    writeMarker();
  } catch {
    // Keychain unavailable or locked. Leave IndexedDB as-is so the user
    // still has a usable key on the Tauri side (the HTTP adapter on Tauri
    // will fail until the keychain accepts a write). No data loss.
  }
}

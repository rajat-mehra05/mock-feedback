/**
 * Platform surface contracts. Web and Tauri adapters implement these.
 * Surfaces are fleshed out across phases:
 *   - storage: Phase 5
 *   - analytics: Phase 6
 *   - http (OpenAI): Phase 7
 *   - updater: Phase 10
 */

export type PlatformTarget = 'web' | 'tauri';

export interface SecretsAdapter {
  set(key: string, value: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(key: string): Promise<void>;
}

export interface StorageAdapter {
  secrets: SecretsAdapter;
}

export interface AnalyticsAdapter {
  track(name: string, props?: Record<string, string | number | boolean>): Promise<void>;
}

// The HTTP surface (chat, transcribe, tts) is defined in Phase 7.
// Kept as an empty object shape for now so Platform can reference it.
export type HttpAdapter = Record<string, never>;

export interface Platform {
  target: PlatformTarget;
  storage: StorageAdapter;
  analytics: AnalyticsAdapter;
  http: HttpAdapter;
}

/** Canonical identifier for the OpenAI API key in the secrets adapter. */
export const SECRET_OPENAI_API_KEY = 'openai_api_key';

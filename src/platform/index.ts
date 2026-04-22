import type { Platform } from './types';

// Build-time target selection. `import.meta.env.VITE_TARGET` is replaced with
// a string literal by Vite (via `define`), which lets the bundler DCE the
// unused branch so `@vercel/analytics` never ships in the Tauri build and
// the Tauri adapter never ships on web.
//
// Top-level await keeps the export eager from the caller's perspective while
// giving Vite a dynamic import on each branch — exactly what DCE needs.
let impl: Platform;
if (import.meta.env.VITE_TARGET === 'tauri') {
  impl = (await import('./tauri')).tauriPlatform;
} else {
  impl = (await import('./web')).webPlatform;
}

export const platform: Platform = impl;

export type {
  AnalyticsAdapter,
  ChatDelta,
  ChatMessage,
  ChatRequest,
  HttpAdapter,
  OpenAIHttpAdapter,
  Platform,
  PlatformTarget,
  PreferencesAdapter,
  Question,
  SecretsAdapter,
  Session,
  SessionsAdapter,
  StorageAdapter,
  TranscribeRequest,
  TtsRequest,
  TtsResponseFormat,
} from './types';
export { SECRET_OPENAI_API_KEY } from './types';

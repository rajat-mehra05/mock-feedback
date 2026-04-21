import { tauriPlatform } from './tauri';
import type { Platform } from './types';
import { webPlatform } from './web';

export const platform: Platform =
  import.meta.env.VITE_TARGET === 'tauri' ? tauriPlatform : webPlatform;

export type {
  AnalyticsAdapter,
  HttpAdapter,
  Platform,
  PlatformTarget,
  SecretsAdapter,
  StorageAdapter,
} from './types';
export { SECRET_OPENAI_API_KEY } from './types';

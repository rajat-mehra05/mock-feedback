import type { Platform } from '../types';

function notImplemented(): Promise<never> {
  return Promise.reject(new Error('Tauri secrets adapter is not wired yet. Lands in Phase 7.'));
}

export const tauriPlatform: Platform = {
  target: 'tauri',
  storage: {
    secrets: {
      set: notImplemented,
      has: notImplemented,
      clear: notImplemented,
    },
  },
  analytics: {
    // Desktop stays silent per Phase 6. No-op rather than stub.
    track: () => Promise.resolve(),
  },
  http: {},
};

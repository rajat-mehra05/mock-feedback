// No-op replacement for virtual:pwa-register/react in Tauri builds.
// Aliased in vite.config.ts; shape mirrors the real hook return.

interface RegisterSWOptions {
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
  onRegisterError?: (error: Error) => void;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}

const noopSetter = (() => undefined) as (next: boolean) => void;
const noopUpdate = () => Promise.resolve();

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- type-compat stub, args are intentionally ignored
export function useRegisterSW(_options?: RegisterSWOptions) {
  return {
    needRefresh: [false, noopSetter] as [boolean, (next: boolean) => void],
    offlineReady: [false, noopSetter] as [boolean, (next: boolean) => void],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- type-compat stub, args are intentionally ignored
    updateServiceWorker: (_reloadPage?: boolean) => noopUpdate(),
  };
}

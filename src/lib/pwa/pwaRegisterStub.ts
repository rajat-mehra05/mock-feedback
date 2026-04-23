// No-op replacement for `virtual:pwa-register/react` in non-PWA builds
// (currently the Tauri target). The real virtual module is provided by
// vite-plugin-pwa, which only runs in the web build. Vite's resolve
// alias swaps this stub in when the plugin is absent so any UpdateBanner
// import compiles without exploding.
//
// The shape mirrors the real hook return so call sites don't need to know
// whether they're running against the stub or the real registration.

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

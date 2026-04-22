/**
 * Phase 9.4: warm the AudioWorklet pipeline before the first recording.
 *
 * The first `audioWorklet.addModule(...)` call on a fresh context pays three
 * costs: HTTP fetch of the worklet JS, parse/compile, and the context's own
 * init. We create a throwaway AudioContext at boot and register the module
 * against it. The file lands in the HTTP cache and the engine's parse cache,
 * so the recorder's per-session `addModule` call is near-instant.
 *
 * Best-effort: if the context can't be constructed (SSR, locked-down
 * webview) we silently skip — the recorder's own `addModule` will run cold
 * instead of throwing.
 */
const WORKLET_URL = `${import.meta.env.BASE_URL}audio/downsample-worklet.js`;

let preloadPromise: Promise<void> | null = null;

export function preloadDownsampleWorklet(): Promise<void> {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    if (typeof window === 'undefined' || !window.AudioContext) return;

    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      await ctx.audioWorklet.addModule(WORKLET_URL);
    } catch {
      // Silent: recorder will retry addModule against its own context.
      preloadPromise = null;
    } finally {
      if (ctx && ctx.state !== 'closed') void ctx.close();
    }
  })();

  return preloadPromise;
}

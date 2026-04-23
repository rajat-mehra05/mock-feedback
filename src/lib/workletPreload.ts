// Warm the AudioWorklet before the first recording so the recorder's
// `addModule` hits the HTTP + engine parse caches. Silently skips when the
// context can't be constructed (SSR, locked-down webviews).
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

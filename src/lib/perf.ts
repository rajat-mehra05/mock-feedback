/**
 * Lightweight pipeline instrumentation. Each mark captures `performance.now()`
 * so we can measure turn-latency stages end-to-end. Dev builds also print
 * elapsed ms per stage; prod builds stay silent.
 *
 * Stage graph:
 *   mic_stop → transcribe_start → transcribe_end → chat_start →
 *   first_token → last_token → tts_start → first_audio → playback_start
 */

export type PerfStage =
  | 'mic_stop'
  | 'transcribe_start'
  | 'transcribe_end'
  | 'chat_start'
  | 'chat_end'
  | 'first_token'
  | 'last_token'
  | 'tts_start'
  | 'first_audio'
  | 'playback_start'
  | 'playback_end';

const DEV =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env !== 'undefined' &&
  Boolean(import.meta.env.DEV);

let prev: number | null = null;

export function mark(stage: PerfStage): void {
  if (typeof performance === 'undefined') return;
  performance.mark(stage);
  if (!DEV) return;
  const now = performance.now();
  if (prev == null) {
    console.debug(`[perf] ${stage} @ ${Math.round(now)}ms`);
  } else {
    console.debug(`[perf] ${stage} +${Math.round(now - prev)}ms`);
  }
  prev = now;
}

/** Resets the running delta so a new turn starts at +0ms. */
export function resetPerf(): void {
  prev = null;
}

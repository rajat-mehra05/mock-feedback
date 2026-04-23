// Writes a stage timestamp to the browser's Performance timeline so turn
// latency can be inspected via `performance.getEntriesByType('mark')`.
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

export function mark(stage: PerfStage): void {
  if (typeof performance === 'undefined') return;
  performance.mark(stage);
}

/**
 * Audio-capture constants shared between the recorder, the transcription
 * service, and the Rust commit path. The AudioWorklet at
 * `public/audio/downsample-worklet.js` has its own copy (AudioWorkletGlobalScope
 * has no module system) — keep it in sync if you change this value.
 */

/** Worklet resamples to this rate, WAV header reports this rate, and
 *  OpenAI's transcription model uses this rate natively. */
export const CAPTURE_SAMPLE_RATE = 16000;

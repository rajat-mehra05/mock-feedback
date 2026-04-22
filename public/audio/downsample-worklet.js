/**
 * AudioWorkletProcessor that downsamples mic audio from the hardware sample
 * rate (typically 48kHz on WKWebView, 44.1 or 48kHz elsewhere) to 16kHz mono
 * 16-bit PCM, which matches OpenAI's internal transcription rate. The upload
 * shrinks ~5x vs the original webm/mp4 container.
 *
 * Output: Int16Array chunks posted via `port.postMessage` with ArrayBuffer
 * transfer so there's no copy cost. The main thread accumulates them and
 * either pushes to the Rust-side buffer (Tauri, Phase 9.2) or keeps them for
 * a WAV blob on stop (web).
 *
 * Plain JS (no imports, no TS) because AudioWorkletGlobalScope doesn't run
 * ES modules through Vite's pipeline — the file is served straight out of
 * `public/` and loaded via `audioWorklet.addModule(url)`.
 */
const TARGET_SAMPLE_RATE = 16000;
// `process()` is called once per 128-sample render quantum, so at 48kHz
// hardware that's ~375 times/second. Posting each quantum separately means
// ~375 main-thread messages/second and (on Tauri) 375 IPC invokes/second —
// enough to eat ~37% CPU on IPC alone. Batch ~250ms of output into each
// postMessage so we're at 4 messages/second instead.
const BATCH_SAMPLES = TARGET_SAMPLE_RATE / 4;

class DownsampleProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // `sampleRate` is a global injected by the worklet runtime — the output
    // rate of the AudioContext that loaded us.
    this.ratio = sampleRate / TARGET_SAMPLE_RATE;
    // Fractional cursor that carries from one render quantum to the next
    // so sample positions stay aligned across buffer boundaries.
    this.carry = 0;
    // Accumulator: ~BATCH_SAMPLES samples of 16kHz Int16 PCM. Flushed via
    // postMessage whenever it fills, or on final flush via the main-thread
    // port message (see below).
    this.batch = new Int16Array(BATCH_SAMPLES);
    this.batchOffset = 0;
    this.port.onmessage = (event) => {
      // Main thread asks us to flush the tail (on stop) before the graph
      // is torn down so the trailing < 250ms isn't lost. After flushing
      // the data we post a sentinel so the main thread knows the final
      // Int16Array has already landed and it's safe to build the WAV.
      if (event.data === 'flush') {
        this.flush();
        this.port.postMessage({ kind: 'flushed' });
      }
    };
  }

  flush() {
    if (this.batchOffset === 0) return;
    // When the batch is full, transfer its buffer directly instead of
    // copying via `slice` — saves ~4KB of copy work per 250ms. Partial
    // flushes (final drain) still need the slice.
    const out =
      this.batchOffset === this.batch.length
        ? this.batch
        : this.batch.slice(0, this.batchOffset);
    this.port.postMessage(out, [out.buffer]);
    this.batch = new Int16Array(BATCH_SAMPLES);
    this.batchOffset = 0;
  }

  /**
   * @param {Float32Array[][]} inputs
   */
  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || input[0].length === 0) {
      return true;
    }

    const channels = input.length;
    const frames = input[0].length;

    // Downmix to mono. `channels === 1` is a cheap path; otherwise average.
    const mono = new Float32Array(frames);
    if (channels === 1) {
      mono.set(input[0]);
    } else {
      for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += input[c][i];
        mono[i] = sum / channels;
      }
    }

    // Linear-interpolation resampler. Good enough for speech transcription —
    // the target model already applies its own filtering upstream.
    const maxOut = Math.ceil((frames - this.carry) / this.ratio);
    let written = 0;
    for (let i = 0; i < maxOut; i++) {
      const pos = this.carry + i * this.ratio;
      if (pos >= frames) break;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = mono[idx];
      const b = idx + 1 < frames ? mono[idx + 1] : a;
      const sample = a + (b - a) * frac;
      // Float32 → Int16 with symmetric scaling and clipping.
      const clipped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
      const i16 = clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff;

      // Append to the batch; flush when full so the main thread sees chunks
      // at a steady ~4 Hz instead of ~375 Hz.
      this.batch[this.batchOffset++] = i16;
      if (this.batchOffset >= this.batch.length) this.flush();
      written++;
    }
    // Advance carry so the next buffer picks up at the right sub-sample.
    this.carry = this.carry + written * this.ratio - frames;

    return true;
  }
}

registerProcessor('downsample-processor', DownsampleProcessor);

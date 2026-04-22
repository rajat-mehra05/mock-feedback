/**
 * Pure state machine for the streaming TTS pipeline. The MediaSource-backed
 * bridge in `src/platform/tauri/http/ttsPlayback.ts` drives it by calling
 * `push`, `end`, `fail` at the right lifecycle points and polling
 * `nextChunk` / `canEndStream` from its flush loop. Extracted so the
 * ordering + terminal-flag invariants can be tested without the DOM half
 * (jsdom has no MediaSource / HTMLAudioElement).
 *
 * Invariants the bridge relies on:
 *   - `push` / `end` are no-ops once the queue is closed or errored.
 *   - `fail` clears the queue so a subsequent `nextChunk` returns nothing.
 *   - `canEndStream` is only true after `end` AND the queue has drained.
 *   - Chunks come out in FIFO order.
 */
export class TtsChunkQueue {
  private chunks: Uint8Array[] = [];
  private closedFlag = false;
  private erroredFlag = false;

  /** Enqueue a chunk. Ignored if the queue has already been closed by
   *  `end` or terminated by `fail`. */
  push(bytes: Uint8Array): void {
    if (this.closedFlag || this.erroredFlag) return;
    this.chunks.push(bytes);
  }

  /** Signal that no more chunks will arrive. `canEndStream` flips true once
   *  the remaining chunks have been drained by `nextChunk`. No-op if
   *  already closed or errored. */
  end(): void {
    if (this.closedFlag || this.erroredFlag) return;
    this.closedFlag = true;
  }

  /** Terminal error. Drops all queued chunks so subsequent `nextChunk`
   *  calls return undefined — the bridge should tear down the audio graph
   *  after this. Idempotent. */
  fail(): void {
    if (this.erroredFlag) return;
    this.erroredFlag = true;
    this.chunks = [];
  }

  /** Pull the next chunk for append. Returns undefined if the queue is
   *  empty or has been errored. */
  nextChunk(): Uint8Array | undefined {
    if (this.erroredFlag) return undefined;
    return this.chunks.shift();
  }

  /** True once `end` has fired, the queue has drained, and no error has
   *  occurred. The bridge uses this to decide when to call
   *  `mediaSource.endOfStream()`. */
  canEndStream(): boolean {
    return this.closedFlag && !this.erroredFlag && this.chunks.length === 0;
  }

  /** `end` has been called. */
  get isClosed(): boolean {
    return this.closedFlag;
  }

  /** `fail` has been called (or an internal error set it). */
  get isErrored(): boolean {
    return this.erroredFlag;
  }

  /** Remaining queued chunks. Exposed for tests and diagnostics; the
   *  bridge doesn't need it. */
  get size(): number {
    return this.chunks.length;
  }
}

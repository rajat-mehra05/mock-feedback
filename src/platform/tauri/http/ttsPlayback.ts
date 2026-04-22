/**
 * MediaSource-backed streaming playback for Tauri. Bytes are pushed chunk by
 * chunk as they arrive from Rust. Playback starts as soon as the first chunk
 * is appended so first-audio latency is under ~300ms on a warm connection.
 *
 * Assumes mp3 bytes (matches TTS_RESPONSE_FORMAT). Falls back to full-buffer
 * decode if MediaSource is unavailable (rare in modern webviews).
 */

import { mark } from '@/lib/perf';
import { TtsChunkQueue } from '@/lib/ttsChunkQueue';

const MIME = 'audio/mpeg';

export interface TtsStreamController {
  push(bytes: Uint8Array): void;
  end(): void;
  fail(error: Error): void;
  finished: Promise<void>;
}

export function playMediaSourceStream(signal?: AbortSignal): TtsStreamController {
  const audio = new Audio();
  audio.autoplay = true;
  let firstChunk = true;
  const markFirstChunk = () => {
    if (firstChunk) {
      firstChunk = false;
      mark('first_audio');
    }
  };

  let resolve!: () => void;
  let reject!: (err: Error) => void;
  const finished = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  if (!('MediaSource' in window) || !MediaSource.isTypeSupported(MIME)) {
    // Fallback: buffer everything then decode+play.
    const fallbackChunks: Uint8Array[] = [];
    let ended = false;

    const onFallbackAbort = () => {
      if (ended) return;
      ended = true;
      signal?.removeEventListener('abort', onFallbackAbort);
      reject(new DOMException('Audio playback aborted', 'AbortError'));
    };
    if (signal) {
      if (signal.aborted) {
        onFallbackAbort();
      } else {
        signal.addEventListener('abort', onFallbackAbort, { once: true });
      }
    }

    const controller: TtsStreamController = {
      push(bytes) {
        if (ended) return;
        markFirstChunk();
        fallbackChunks.push(bytes);
      },
      end() {
        if (ended) return;
        ended = true;
        signal?.removeEventListener('abort', onFallbackAbort);
        void (async () => {
          try {
            const total = fallbackChunks.reduce((n, c) => n + c.byteLength, 0);
            const merged = new Uint8Array(total);
            let offset = 0;
            for (const c of fallbackChunks) {
              merged.set(c, offset);
              offset += c.byteLength;
            }
            const { playAudioArrayBuffer } = await import('@/services/tts/playback');
            await playAudioArrayBuffer(merged.buffer, signal);
            resolve();
          } catch (err) {
            reject(err instanceof Error ? err : new Error('playback failed'));
          }
        })();
      },
      fail(error) {
        if (ended) return;
        ended = true;
        signal?.removeEventListener('abort', onFallbackAbort);
        reject(error);
      },
      finished,
    };
    return controller;
  }

  const mediaSource = new MediaSource();
  const objectUrl = URL.createObjectURL(mediaSource);
  audio.src = objectUrl;

  // Chunk ordering + closed/errored lifecycle flags live in a pure helper
  // so invariants (push-after-close is a no-op, fail drains the queue,
  // canEndStream is true only after drain) are covered by tests that don't
  // need jsdom's missing MediaSource/HTMLAudioElement. See
  // `src/lib/ttsChunkQueue.ts`.
  const queue = new TtsChunkQueue();
  let sourceBuffer: SourceBuffer | null = null;

  const cleanupAudio = () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(objectUrl);
    // Explicitly unregister so we don't accumulate listeners across a
    // session's speak() calls when playback completes naturally (natural
    // completion doesn't trigger `once: true` removal).
    if (signal) signal.removeEventListener('abort', onAbort);
  };

  const failStream = (err: Error) => {
    if (queue.isErrored) return;
    queue.fail();
    cleanupAudio();
    reject(err);
  };

  const flush = () => {
    if (queue.isErrored || !sourceBuffer || sourceBuffer.updating) return;
    const next = queue.nextChunk();
    if (next) {
      try {
        // Pass the view directly so only the actual chunk region is appended,
        // regardless of whether `next` is a fresh allocation or a subview.
        sourceBuffer.appendBuffer(next as unknown as BufferSource);
      } catch (err) {
        failStream(err instanceof Error ? err : new Error('appendBuffer failed'));
      }
      return;
    }
    if (queue.canEndStream() && mediaSource.readyState === 'open') {
      try {
        mediaSource.endOfStream();
      } catch {
        // ignore — endOfStream can throw if already ended
      }
    }
  };

  mediaSource.addEventListener('sourceopen', () => {
    // If an abort or earlier error already settled the stream, skip setup so
    // we don't call reject/cleanupAudio twice.
    if (queue.isErrored) return;
    try {
      sourceBuffer = mediaSource.addSourceBuffer(MIME);
      sourceBuffer.addEventListener('updateend', flush);
      flush();
    } catch (err) {
      failStream(err instanceof Error ? err : new Error('addSourceBuffer failed'));
    }
  });

  audio.addEventListener('ended', () => {
    cleanupAudio();
    if (!queue.isErrored) resolve();
  });
  audio.addEventListener('error', () => {
    failStream(new Error('audio element error'));
  });

  const onAbort = () => {
    failStream(new DOMException('Audio playback aborted', 'AbortError'));
  };
  if (signal) {
    if (signal.aborted) {
      onAbort();
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  }

  // Kick playback as soon as metadata is ready. Safari sometimes needs an
  // explicit play() call because autoplay can be gated.
  audio.addEventListener('canplay', () => {
    void audio.play().catch(() => {
      // If play() rejects because of a transient state, the browser will retry
      // once more data is buffered. Genuine failures surface via the error event.
    });
  });

  return {
    push(bytes) {
      if (queue.isErrored || queue.isClosed) return;
      markFirstChunk();
      queue.push(bytes);
      flush();
    },
    end() {
      if (queue.isErrored || queue.isClosed) return;
      queue.end();
      flush();
    },
    fail(error) {
      failStream(error);
    },
    finished,
  };
}

/**
 * MediaSource-backed streaming playback for Tauri. Bytes are pushed chunk by
 * chunk as they arrive from Rust. Playback starts as soon as the first chunk
 * is appended so first-audio latency is under ~300ms on a warm connection.
 *
 * Assumes mp3 bytes (matches TTS_RESPONSE_FORMAT). Falls back to full-buffer
 * decode if MediaSource is unavailable (rare in modern webviews).
 */

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
        if (!ended) fallbackChunks.push(bytes);
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

  const pending: Uint8Array[] = [];
  let sourceBuffer: SourceBuffer | null = null;
  let endOfStreamRequested = false;
  let errored = false;

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

  const flush = () => {
    if (!sourceBuffer || sourceBuffer.updating) return;
    const next = pending.shift();
    if (next) {
      try {
        sourceBuffer.appendBuffer(next.buffer as ArrayBuffer);
      } catch (err) {
        errored = true;
        cleanupAudio();
        reject(err instanceof Error ? err : new Error('appendBuffer failed'));
      }
      return;
    }
    if (endOfStreamRequested && mediaSource.readyState === 'open') {
      try {
        mediaSource.endOfStream();
      } catch {
        // ignore — endOfStream can throw if already ended
      }
    }
  };

  mediaSource.addEventListener('sourceopen', () => {
    try {
      sourceBuffer = mediaSource.addSourceBuffer(MIME);
      sourceBuffer.addEventListener('updateend', flush);
      flush();
    } catch (err) {
      errored = true;
      cleanupAudio();
      reject(err instanceof Error ? err : new Error('addSourceBuffer failed'));
    }
  });

  audio.addEventListener('ended', () => {
    cleanupAudio();
    if (!errored) resolve();
  });
  audio.addEventListener('error', () => {
    if (errored) return;
    errored = true;
    cleanupAudio();
    reject(new Error('audio element error'));
  });

  const onAbort = () => {
    if (errored) return;
    errored = true;
    cleanupAudio();
    reject(new DOMException('Audio playback aborted', 'AbortError'));
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
      if (errored) return;
      pending.push(bytes);
      flush();
    },
    end() {
      if (errored) return;
      endOfStreamRequested = true;
      flush();
    },
    fail(error) {
      if (errored) return;
      errored = true;
      cleanupAudio();
      reject(error);
    },
    finished,
  };
}

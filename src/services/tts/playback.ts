/**
 * Decodes and plays a full-buffer mp3/wav/etc. Resolves when playback ends,
 * rejects on abort or decode error. Shared by web adapter; Tauri adapter uses
 * its own MediaSource-based streaming playback.
 */
export async function playAudioArrayBuffer(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException('Audio playback aborted', 'AbortError');
  }
  const audioContext = new AudioContext();
  const closeContext = () => {
    if (audioContext.state !== 'closed') void audioContext.close();
  };

  // iOS Safari opens a fresh AudioContext in the 'suspended' state
  // regardless of user activation. Explicit resume() nudges it awake.
  // On Chromium desktop the context is already 'running' so resume() is
  // effectively a no-op. resume() rejects only if the context is
  // already closed, which can't happen this early.
  if (audioContext.state === 'suspended') {
    await audioContext.resume().catch(() => {
      // If resume() fails (can happen when the call chain has lost its
      // user-activation trail on iOS), let the subsequent start() still
      // try. Either the user gesture is still valid or playback silently
      // fails — in the latter case the caller's AbortSignal or the STT
      // flow's timeout will surface the stall.
    });
  }

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(buffer);
  } catch (error) {
    // MediaSession + visibilitychange get attached *after* this decode
    // block, so there's nothing to unregister here. Just close the
    // context and surface the error.
    closeContext();
    if (signal?.aborted) {
      throw new DOMException('Audio playback aborted', 'AbortError');
    }
    throw error;
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  // Lock-screen / Control Center integration on mobile. iOS + Android
  // display whatever MediaSession metadata is set while audio is
  // playing. Without this the lock-screen shows a generic "web
  // content" tile instead of the app name.
  //
  // Per-question title (e.g. "Question 3 of 10") would be nicer but
  // requires plumbing the question index through speak(). Left as a
  // follow-up; generic app-name metadata covers the regression case
  // (no tile at all) which is the main UX complaint.
  const mediaSession = typeof navigator !== 'undefined' ? navigator.mediaSession : undefined;
  const previousMetadata = mediaSession?.metadata ?? null;
  if (mediaSession && typeof MediaMetadata !== 'undefined') {
    mediaSession.metadata = new MediaMetadata({
      title: 'VoiceRound',
      artist: 'Mock interview',
      artwork: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    });
  }
  const clearMediaSession = () => {
    if (!mediaSession) return;
    // Restore whatever was set before (null on a fresh session) so we
    // don't leave a stale "VoiceRound playing" tile after the audio
    // ends.
    mediaSession.metadata = previousMetadata;
    try {
      mediaSession.setActionHandler('play', null);
      mediaSession.setActionHandler('pause', null);
    } catch {
      /* some browsers throw on unknown actions; safe to ignore */
    }
  };

  // Suspend the context when the tab goes hidden and resume on visible.
  // Without this, iOS Safari suspends the context for us but doesn't
  // always resume cleanly when the user switches back; manual control
  // makes the transition deterministic. Also covers the "phone rings
  // mid-TTS" case on mobile.
  const onVisibilityChange = () => {
    if (audioContext.state === 'closed') return;
    if (document.hidden) {
      void audioContext.suspend().catch(() => {
        /* best-effort */
      });
    } else {
      void audioContext.resume().catch(() => {
        /* best-effort */
      });
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);

  // Action handlers on the MediaSession let users pause/resume from the
  // lock screen or Control Center. Suspend/resume the AudioContext to
  // match — pausing via setValueAtTime on the node would leave the
  // context running and burn battery.
  if (mediaSession) {
    try {
      mediaSession.setActionHandler('pause', () => {
        if (audioContext.state === 'running') {
          void audioContext.suspend().catch(() => undefined);
        }
        mediaSession.playbackState = 'paused';
      });
      mediaSession.setActionHandler('play', () => {
        if (audioContext.state === 'suspended') {
          void audioContext.resume().catch(() => undefined);
        }
        mediaSession.playbackState = 'playing';
      });
      mediaSession.playbackState = 'playing';
    } catch {
      /* ignore browsers without action-handler support */
    }
  }

  return new Promise<void>((resolve, reject) => {
    const teardown = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearMediaSession();
    };

    const abortHandler = () => {
      source.onended = null;
      // `source.stop()` throws InvalidStateError if called before `start()`.
      // Abort can fire in the narrow window between listener registration and
      // the `start()` call below; swallow the throw so we still reject cleanly.
      try {
        source.stop();
      } catch {
        // not yet started — nothing to stop
      }
      teardown();
      closeContext();
      reject(new DOMException('Audio playback aborted', 'AbortError'));
    };

    const cleanupListeners = () => {
      source.onended = null;
      if (signal) signal.removeEventListener('abort', abortHandler);
      teardown();
    };

    source.onended = () => {
      cleanupListeners();
      closeContext();
      resolve();
    };

    if (signal) {
      if (signal.aborted) {
        teardown();
        closeContext();
        reject(new DOMException('Audio playback aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', abortHandler, { once: true });
    }

    try {
      source.start();
    } catch (error) {
      cleanupListeners();
      closeContext();
      reject(error instanceof Error ? error : new Error('Failed to start audio playback'));
    }
  });
}

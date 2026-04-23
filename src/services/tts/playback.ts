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
  // effectively a no-op.
  //
  // If resume() rejects or the state stays 'suspended', source.start()
  // below would queue playback but no audio would actually play (iOS
  // fires no error, it simply stays silent). Propagate the failure so
  // the caller can surface it or retry on the next user gesture.
  if (audioContext.state === 'suspended') {
    await audioContext.resume().catch(() => undefined);
  }
  if (audioContext.state !== 'running') {
    closeContext();
    throw new Error(
      `AudioContext could not resume (state: ${audioContext.state}). On iOS this usually means user activation was consumed before playback started.`,
    );
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

  // Two flags coordinate visibility-driven and user-driven pause/resume
  // so they don't fight each other. Without them the visibility handler
  // on tab-restore would unconditionally resume() and override a
  // user-initiated pause from the lock screen.
  //
  //   visibilitySuspended: true when WE suspended due to document.hidden
  //     (so we know it's safe to resume on visible without overriding
  //     user intent)
  //   userPaused: true when the user pressed pause on the lock screen
  //     or Control Center (so visibility-restore knows to keep paused)
  let visibilitySuspended = false;
  let userPaused = false;

  // Suspend the context when the tab goes hidden and resume on visible
  // unless the user has paused via the lock-screen control.
  // Without this, iOS Safari suspends the context for us but doesn't
  // always resume cleanly when the user switches back; manual control
  // makes the transition deterministic. Also covers the "phone rings
  // mid-TTS" case on mobile.
  const onVisibilityChange = () => {
    if (audioContext.state === 'closed') return;
    if (document.hidden) {
      // Only suspend if currently running. If user already paused,
      // don't change the suspended-by-visibility flag — they get to
      // own that state.
      if (audioContext.state === 'running') {
        visibilitySuspended = true;
        void audioContext.suspend().catch(() => {
          /* best-effort */
        });
      }
    } else {
      // Resume only if WE were the one who suspended AND the user
      // hasn't pressed pause in the meantime. Otherwise we'd override
      // their explicit pause when they tab back to the app.
      if (visibilitySuspended && !userPaused) {
        visibilitySuspended = false;
        void audioContext.resume().catch(() => {
          /* best-effort */
        });
      } else if (visibilitySuspended) {
        // User paused while tab was hidden. Clear the flag without
        // resuming so a later user-play action handles the resume.
        visibilitySuspended = false;
      }
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
        userPaused = true;
        if (audioContext.state === 'running') {
          void audioContext.suspend().catch(() => undefined);
        }
        mediaSession.playbackState = 'paused';
      });
      mediaSession.setActionHandler('play', () => {
        userPaused = false;
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

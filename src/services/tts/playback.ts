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

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(buffer);
  } catch (error) {
    closeContext();
    if (signal?.aborted) {
      throw new DOMException('Audio playback aborted', 'AbortError');
    }
    throw error;
  }

  const source = audioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioContext.destination);

  return new Promise<void>((resolve, reject) => {
    const abortHandler = () => {
      source.onended = null;
      source.stop();
      closeContext();
      reject(new DOMException('Audio playback aborted', 'AbortError'));
    };

    const cleanupListeners = () => {
      source.onended = null;
      if (signal) signal.removeEventListener('abort', abortHandler);
    };

    source.onended = () => {
      cleanupListeners();
      closeContext();
      resolve();
    };

    if (signal) {
      if (signal.aborted) {
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

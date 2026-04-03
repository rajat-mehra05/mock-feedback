import { getOpenAIClient } from '@/services/openai/openai';
import { classifyOpenAIError, createTimeoutSignal } from '@/services/openai/openaiErrors';
import {
  TTS_MODEL,
  TTS_VOICE,
  TTS_TIMEOUT_MS,
  TTS_INSTRUCTIONS,
  TTS_RESPONSE_FORMAT,
} from '@/constants/openai';

/**
 * Speaks the given text aloud using OpenAI TTS.
 * Resolves when audio finishes playing, rejects on abort or error.
 *
 * The network timeout (TTS_TIMEOUT_MS) only guards the API call and response
 * download. Playback is governed only by the caller's abort signal so that
 * long questions are never cut off mid-speech.
 */
export async function speakText(text: string, signal?: AbortSignal): Promise<void> {
  const client = await getOpenAIClient();
  const { signal: networkSignal, cleanup } = createTimeoutSignal(TTS_TIMEOUT_MS, signal);

  let arrayBuffer: ArrayBuffer;
  try {
    const response = await client.audio.speech.create(
      {
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: text,
        instructions: TTS_INSTRUCTIONS,
        response_format: TTS_RESPONSE_FORMAT,
      },
      { signal: networkSignal },
    );
    arrayBuffer = await response.arrayBuffer();
  } catch (error) {
    cleanup();
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally throws classified OpenAIServiceError object
    throw classifyOpenAIError(error);
  }

  // Network phase complete — clear the timeout so it doesn't fire during playback
  cleanup();

  // Playback is only cancellable via the caller's signal (e.g. user clicks Stop),
  // not the network timeout, so long questions play to completion.
  await playAudioBuffer(arrayBuffer, signal);
}

async function playAudioBuffer(buffer: ArrayBuffer, signal?: AbortSignal): Promise<void> {
  const audioContext = new AudioContext();
  const closeContext = () => {
    if (audioContext.state !== 'closed') void audioContext.close();
  };

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioContext.decodeAudioData(buffer);
  } catch (error) {
    closeContext();
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

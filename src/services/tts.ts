import { getOpenAIClient } from '@/services/openai';
import { classifyOpenAIError, createTimeoutSignal } from '@/services/openaiErrors';
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
 */
export async function speakText(text: string, signal?: AbortSignal): Promise<void> {
  const client = await getOpenAIClient();
  const { signal: mergedSignal, cleanup } = createTimeoutSignal(TTS_TIMEOUT_MS, signal);

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
      { signal: mergedSignal },
    );
    arrayBuffer = await response.arrayBuffer();
  } catch (error) {
    cleanup();
    throw classifyOpenAIError(error);
  }

  try {
    await playAudioBuffer(arrayBuffer, mergedSignal);
  } finally {
    cleanup();
  }
}

async function playAudioBuffer(buffer: ArrayBuffer, signal?: AbortSignal): Promise<void> {
  const audioContext = new AudioContext();
  const closeContext = () => {
    if (audioContext.state !== 'closed') audioContext.close();
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
      reject(error);
    }
  });
}

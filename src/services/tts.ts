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

    const arrayBuffer = await response.arrayBuffer();
    await playAudioBuffer(arrayBuffer, mergedSignal);
  } catch (error) {
    throw classifyOpenAIError(error);
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
    source.onended = () => {
      closeContext();
      resolve();
    };

    if (signal) {
      if (signal.aborted) {
        closeContext();
        reject(new DOMException('Audio playback aborted', 'AbortError'));
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          source.stop();
          closeContext();
          reject(new DOMException('Audio playback aborted', 'AbortError'));
        },
        { once: true },
      );
    }

    source.start();
  });
}

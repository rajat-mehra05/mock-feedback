import { platform } from '@/platform';
import { TTS_INSTRUCTIONS, TTS_MODEL, TTS_RESPONSE_FORMAT, TTS_VOICE } from '@/constants/openai';
import { mark } from '@/lib/perf';

/**
 * Speaks the given text aloud via the platform TTS surface.
 * Resolves when playback finishes, rejects on abort or error.
 */
export async function speakText(text: string, signal?: AbortSignal): Promise<void> {
  mark('tts_start');
  try {
    await platform.http.openai.speak(
      {
        model: TTS_MODEL,
        voice: TTS_VOICE,
        input: text,
        instructions: TTS_INSTRUCTIONS,
        responseFormat: TTS_RESPONSE_FORMAT,
      },
      signal,
    );
  } finally {
    mark('playback_end');
  }
}

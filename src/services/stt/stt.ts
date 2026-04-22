import { platform } from '@/platform';
import { STT_MODEL } from '@/constants/openai';
import { mark } from '@/lib/perf';

/**
 * Transcribes an audio blob using OpenAI's STT model.
 * Returns the transcript text. The adapter handles network timeouts and
 * keychain-backed authentication on Tauri.
 */
export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  mark('transcribe_start');
  try {
    return await platform.http.openai.transcribe(
      { model: STT_MODEL, audio: blob, filename: 'recording.webm' },
      signal,
    );
  } finally {
    mark('transcribe_end');
  }
}

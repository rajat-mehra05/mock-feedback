import { getOpenAIClient } from '@/services/openai/openai';
import { classifyOpenAIError, createTimeoutSignal } from '@/services/openai/openaiErrors';
import { STT_MODEL, STT_PROMPT_HINT, STT_TIMEOUT_MS } from '@/constants/openai';

/**
 * Transcribes an audio blob using OpenAI's STT model.
 * Returns the transcript text.
 */
export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  const client = await getOpenAIClient();
  const file = new File([blob], 'recording.webm', { type: blob.type });
  const { signal: mergedSignal, cleanup } = createTimeoutSignal(STT_TIMEOUT_MS, signal);

  try {
    const response = await client.audio.transcriptions.create(
      { model: STT_MODEL, file, prompt: STT_PROMPT_HINT },
      { signal: mergedSignal },
    );
    return response.text;
  } catch (error) {
    throw classifyOpenAIError(error);
  } finally {
    cleanup();
  }
}

import { getOpenAIClient } from '@/services/openai/openai';
import { classifyOpenAIError, createTimeoutSignal } from '@/services/openai/openaiErrors';
import {
  LLM_MODEL,
  LLM_TIMEOUT_MS,
  LLM_TEMPERATURE,
  LLM_MAX_TOKENS,
  INTERVIEW_SYSTEM_PROMPT,
} from '@/constants/openai';
import type { ConversationTurn } from '@/services/types';

/**
 * Generates the next interview question based on topic and conversation history.
 * Empty history means it's the first question — the system prompt alone drives it.
 */
export async function generateNextQuestion(
  topic: string,
  history: ConversationTurn[],
  signal?: AbortSignal,
): Promise<string> {
  const client = await getOpenAIClient();
  const systemPrompt = INTERVIEW_SYSTEM_PROMPT.replace('{topic}', topic);
  const { signal: mergedSignal, cleanup } = createTimeoutSignal(LLM_TIMEOUT_MS, signal);

  const messages: Array<{ role: 'system' | 'assistant' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.flatMap((turn) => [
      { role: 'assistant' as const, content: turn.question },
      { role: 'user' as const, content: turn.answer },
    ]),
  ];

  try {
    const response = await client.chat.completions.create(
      {
        model: LLM_MODEL,
        messages,
        temperature: LLM_TEMPERATURE,
        max_tokens: LLM_MAX_TOKENS,
      },
      { signal: mergedSignal },
    );
    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('Empty response from LLM');
    return text.trim();
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally throws classified OpenAIServiceError object
    throw classifyOpenAIError(error);
  } finally {
    cleanup();
  }
}

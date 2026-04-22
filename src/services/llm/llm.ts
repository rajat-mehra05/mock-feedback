import { platform } from '@/platform';
import { LLM_MAX_TOKENS, LLM_MODEL, LLM_TEMPERATURE } from '@/constants/openai';
import { buildInterviewPrompt } from '@/constants/prompts';
import { mark } from '@/lib/perf';
import type { ConversationTurn } from '@/services/types';

/**
 * Generates the next interview question based on topic and conversation history.
 * Empty history means it's the first question — the system prompt alone drives it.
 */
export async function generateNextQuestion(
  topicLabel: string,
  history: ConversationTurn[],
  signal?: AbortSignal,
  candidateName?: string,
): Promise<string> {
  const systemPrompt = buildInterviewPrompt({ topic: topicLabel, candidateName });
  const messages: Array<{ role: 'system' | 'assistant' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.flatMap((turn) => [
      { role: 'assistant' as const, content: turn.question },
      { role: 'user' as const, content: turn.answer },
    ]),
  ];

  mark('chat_start');
  try {
    const text = await platform.http.openai.chat(
      {
        model: LLM_MODEL,
        messages,
        temperature: LLM_TEMPERATURE,
        maxTokens: LLM_MAX_TOKENS,
      },
      signal,
    );
    return text.trim();
  } finally {
    mark('chat_end');
  }
}

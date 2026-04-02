import { getOpenAIClient } from '@/services/openai/openai';
import { classifyOpenAIError, createTimeoutSignal } from '@/services/openai/openaiErrors';
import { parseFeedbackJSON } from '@/services/feedback/feedbackParser';
import {
  FEEDBACK_MODEL,
  FEEDBACK_TIMEOUT_MS,
  FEEDBACK_TEMPERATURE,
  FEEDBACK_MAX_TOKENS,
  FEEDBACK_SYSTEM_PROMPT,
} from '@/constants/feedback';
import type { ConversationTurn, FeedbackResult } from '@/services/types';

/**
 * Generates structured feedback for all Q&A pairs in a completed interview.
 */
export async function generateFeedback(
  topic: string,
  turns: ConversationTurn[],
  signal?: AbortSignal,
): Promise<FeedbackResult> {
  const client = await getOpenAIClient();
  const systemPrompt = FEEDBACK_SYSTEM_PROMPT.replace('{topic}', topic);
  const { signal: mergedSignal, cleanup } = createTimeoutSignal(FEEDBACK_TIMEOUT_MS, signal);

  const userContent = turns
    .map((t, i) => `Question ${i + 1}: ${t.question}\nAnswer: ${t.answer}`)
    .join('\n\n');

  try {
    const response = await client.chat.completions.create(
      {
        model: FEEDBACK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: FEEDBACK_TEMPERATURE,
        max_tokens: FEEDBACK_MAX_TOKENS,
      },
      { signal: mergedSignal },
    );
    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from feedback generation');
    return parseFeedbackJSON(raw);
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally throws classified OpenAIServiceError object
    throw classifyOpenAIError(error);
  } finally {
    cleanup();
  }
}

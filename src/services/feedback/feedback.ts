import { platform } from '@/platform';
import { parseFeedbackJSON } from '@/services/feedback/feedbackParser';
import {
  FEEDBACK_MAX_TOKENS,
  FEEDBACK_MODEL,
  FEEDBACK_TEMPERATURE,
  FEEDBACK_TIMEOUT_MS,
} from '@/constants/feedback';
import { buildFeedbackPrompt } from '@/constants/prompts';
import type { ConversationTurn, FeedbackResult } from '@/services/types';

/**
 * Generates structured feedback for all Q&A pairs in a completed interview.
 */
interface FeedbackScope {
  focus?: readonly string[];
  outOfScope?: readonly string[];
}

export async function generateFeedback(
  topic: string,
  turns: ConversationTurn[],
  signal?: AbortSignal,
  scope?: FeedbackScope,
): Promise<FeedbackResult> {
  const systemPrompt = buildFeedbackPrompt({ topic, ...scope });
  const userContent = turns
    .map((t, i) => `Question ${i + 1}: ${t.question}\nAnswer: ${t.answer}`)
    .join('\n\n');

  const raw = await platform.http.openai.chat(
    {
      model: FEEDBACK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: FEEDBACK_TEMPERATURE,
      maxTokens: FEEDBACK_MAX_TOKENS,
      timeoutMs: FEEDBACK_TIMEOUT_MS,
    },
    signal,
  );
  return parseFeedbackJSON(raw);
}

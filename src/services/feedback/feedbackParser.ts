import { MAX_SCORE } from '@/constants/session';
import type { FeedbackResult, QuestionFeedback } from '@/services/types';

export function parseFeedbackJSON(raw: string): FeedbackResult {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Failed to parse feedback JSON: invalid JSON');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { questions?: unknown }).questions)
  ) {
    throw new Error('Failed to parse feedback JSON: missing "questions" array');
  }

  const obj = parsed as { questions: unknown[]; summary?: string };

  const questions: QuestionFeedback[] = obj.questions.map((q, i) => {
    if (!q || typeof q !== 'object') {
      throw new Error(`Failed to parse feedback JSON: question ${i} is not an object`);
    }
    const item = q as Record<string, unknown>;
    const rating = Math.max(0, Math.min(MAX_SCORE, Number(item.rating) || 0));
    if (typeof item.feedback !== 'string') {
      throw new Error(
        `Failed to parse feedback JSON: question ${i} has invalid feedback type: ${typeof item.feedback}`,
      );
    }
    if (typeof item.modelAnswer !== 'string') {
      throw new Error(
        `Failed to parse feedback JSON: question ${i} has invalid modelAnswer type: ${typeof item.modelAnswer}`,
      );
    }
    return {
      rating,
      feedback: item.feedback,
      modelAnswer: item.modelAnswer,
    };
  });

  return {
    questions,
    summary: String(obj.summary ?? ''),
  };
}

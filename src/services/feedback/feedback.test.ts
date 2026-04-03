import { expect, test } from 'vitest';
import { parseFeedbackJSON } from '@/services/feedback/feedbackParser';

test('parseFeedbackJSON extracts valid feedback, clamps ratings, and handles edge cases', () => {
  // Valid JSON
  const valid = parseFeedbackJSON(
    JSON.stringify({
      questions: [
        { rating: 8, feedback: 'Good answer', modelAnswer: 'Model here' },
        { rating: 5, feedback: 'Needs work', modelAnswer: 'Better answer' },
      ],
      summary: 'Overall decent',
    }),
  );
  expect(valid.questions).toHaveLength(2);
  expect(valid.questions[0].rating).toBe(8);
  expect(valid.summary).toBe('Overall decent');

  // JSON wrapped in markdown code fences
  const fenced = parseFeedbackJSON(
    '```json\n{"questions":[{"rating":7,"feedback":"ok","modelAnswer":"m"}],"summary":"s"}\n```',
  );
  expect(fenced.questions).toHaveLength(1);
  expect(fenced.questions[0].rating).toBe(7);

  // Ratings clamped: > 10 → 10, < 0 → 0
  const clamped = parseFeedbackJSON(
    JSON.stringify({
      questions: [
        { rating: 15, feedback: 'a', modelAnswer: 'b' },
        { rating: -3, feedback: 'c', modelAnswer: 'd' },
      ],
      summary: 'test',
    }),
  );
  expect(clamped.questions[0].rating).toBe(10);
  expect(clamped.questions[1].rating).toBe(0);

  // Missing required field throws
  expect(() => parseFeedbackJSON('{"notQuestions": []}')).toThrow(/missing.*questions/i);

  // Invalid JSON throws
  expect(() => parseFeedbackJSON('not json at all')).toThrow(/invalid json/i);

  // Missing summary defaults to empty string
  const noSummary = parseFeedbackJSON(
    JSON.stringify({ questions: [{ rating: 6, feedback: 'ok', modelAnswer: 'm' }] }),
  );
  expect(noSummary.summary).toBe('');
});

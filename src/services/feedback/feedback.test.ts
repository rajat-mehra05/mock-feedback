import { expect, test } from 'vitest';
import { parseFeedbackJSON } from '@/services/feedback/feedbackParser';

test('parseFeedbackJSON extracts valid feedback, clamps ratings, parses confidence, and handles edge cases', () => {
  // Valid JSON with confidence
  const valid = parseFeedbackJSON(
    JSON.stringify({
      questions: [
        { rating: 8, feedback: 'Good answer', confidence: 'high', modelAnswer: 'Model here' },
        { rating: 5, feedback: 'Needs work', confidence: 'low', modelAnswer: 'Better answer' },
      ],
      summary: 'Overall decent',
    }),
  );
  expect(valid.questions).toHaveLength(2);
  expect(valid.questions[0].rating).toBe(8);
  expect(valid.questions[0].confidence).toBe('high');
  expect(valid.questions[1].confidence).toBe('low');
  expect(valid.summary).toBe('Overall decent');

  // JSON wrapped in markdown code fences
  const fenced = parseFeedbackJSON(
    '```json\n{"questions":[{"rating":7,"feedback":"ok","confidence":"medium","modelAnswer":"m"}],"summary":"s"}\n```',
  );
  expect(fenced.questions).toHaveLength(1);
  expect(fenced.questions[0].rating).toBe(7);
  expect(fenced.questions[0].confidence).toBe('medium');

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

  // Missing or invalid confidence defaults to 'medium'
  expect(clamped.questions[0].confidence).toBe('medium');
  const invalidConfidence = parseFeedbackJSON(
    JSON.stringify({
      questions: [{ rating: 6, feedback: 'ok', confidence: 'very-high', modelAnswer: 'm' }],
      summary: '',
    }),
  );
  expect(invalidConfidence.questions[0].confidence).toBe('medium');

  // Missing required field throws
  expect(() => parseFeedbackJSON('{"notQuestions": []}')).toThrow(/missing.*questions/i);

  // Invalid JSON throws
  expect(() => parseFeedbackJSON('not json at all')).toThrow(/invalid json/i);

  // Missing summary defaults to empty string
  const noSummary = parseFeedbackJSON(
    JSON.stringify({ questions: [{ rating: 6, feedback: 'ok', modelAnswer: 'm' }] }),
  );
  expect(noSummary.summary).toBe('');

  // Question that is not an object throws
  expect(() => parseFeedbackJSON(JSON.stringify({ questions: [null] }))).toThrow(
    /question 0 is not an object/,
  );
  expect(() => parseFeedbackJSON(JSON.stringify({ questions: ['string'] }))).toThrow(
    /question 0 is not an object/,
  );

  // Non-string feedback throws
  expect(() =>
    parseFeedbackJSON(
      JSON.stringify({ questions: [{ rating: 5, feedback: 123, modelAnswer: 'm' }] }),
    ),
  ).toThrow(/invalid feedback type/i);

  // Non-string modelAnswer throws
  expect(() =>
    parseFeedbackJSON(
      JSON.stringify({ questions: [{ rating: 5, feedback: 'ok', modelAnswer: 999 }] }),
    ),
  ).toThrow(/invalid modelAnswer type/i);
});

import { expect, test } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { saveApiKey } from '@/db/apiKey/apiKey';
import { generateFeedback } from '@/services/feedback/feedback';

const BASE_URL = 'https://api.openai.com/v1';

test('generateFeedback returns parsed feedback from OpenAI and throws classified errors', async () => {
  await saveApiKey('sk-test');

  const feedbackJSON = JSON.stringify({
    questions: [
      { rating: 8, feedback: 'Good explanation of closures.', modelAnswer: 'A closure is...' },
      { rating: 5, feedback: 'Too brief on prototypes.', modelAnswer: 'Prototypes are...' },
    ],
    summary: 'Solid understanding of fundamentals, needs depth on prototypes.',
  });

  server.use(
    http.post(`${BASE_URL}/chat/completions`, () => {
      return HttpResponse.json({
        choices: [{ message: { content: feedbackJSON } }],
      });
    }),
  );

  const result = await generateFeedback('JavaScript', [
    { question: 'Explain closures', answer: 'Functions that capture outer scope' },
    { question: 'Explain prototypes', answer: 'Object inheritance' },
  ]);

  expect(result.questions).toHaveLength(2);
  expect(result.questions[0].rating).toBe(8);
  expect(result.questions[0].modelAnswer).toBe('A closure is...');
  expect(result.summary).toContain('prototypes');

  // API error — 404 model not found
  server.use(
    http.post(`${BASE_URL}/chat/completions`, () => {
      return HttpResponse.json({ error: { message: 'Model not found' } }, { status: 404 });
    }),
  );

  await expect(generateFeedback('React', [{ question: 'Q', answer: 'A' }])).rejects.toMatchObject({
    type: 'not_found',
  });
});

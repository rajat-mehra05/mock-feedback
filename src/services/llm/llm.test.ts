import { expect, test } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { saveApiKey } from '@/db/apiKey/apiKey';
import { generateNextQuestion } from '@/services/llm/llm';

const BASE_URL = 'https://api.openai.com/v1';

test('generateNextQuestion returns a question from the LLM and throws classified errors on failure', async () => {
  await saveApiKey('sk-test');

  // Happy path — first question with empty history
  const question = await generateNextQuestion('React & Next.js', []);
  expect(question).toBe('Can you explain the difference between == and === in JavaScript?');

  // With conversation history — still returns a question
  const followUp = await generateNextQuestion('React & Next.js', [
    { question: 'What is JSX?', answer: 'A syntax extension for JavaScript.' },
  ]);
  expect(typeof followUp).toBe('string');
  expect(followUp.length).toBeGreaterThan(0);

  // API error — 401 auth error
  server.use(
    http.post(`${BASE_URL}/chat/completions`, () => {
      return HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 });
    }),
  );

  await expect(generateNextQuestion('React', [])).rejects.toMatchObject({ type: 'auth' });
});

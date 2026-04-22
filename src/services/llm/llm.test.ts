import { expect, test } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/msw/server';
import { platform, SECRET_OPENAI_API_KEY } from '@/platform';
import { generateNextQuestion } from '@/services/llm/llm';

const BASE_URL = 'https://api.openai.com/v1';

interface CapturedRequest {
  messages: Array<{ role: string; content: string }>;
}

/** Override the chat/completions handler, optionally capturing the request body. */
function useChatHandler(content: string, capture?: (body: CapturedRequest) => void) {
  server.use(
    http.post(`${BASE_URL}/chat/completions`, async ({ request }) => {
      if (capture) capture((await request.json()) as CapturedRequest);
      return HttpResponse.json({ choices: [{ message: { content } }] });
    }),
  );
}

test('generateNextQuestion returns a question, supports candidateName, and throws classified errors', async () => {
  await platform.storage.secrets.set(SECRET_OPENAI_API_KEY, 'sk-test');

  const question = await generateNextQuestion('React & Next.js', []);
  expect(question).toBe('Can you explain the difference between == and === in JavaScript?');

  // With conversation history
  const followUp = await generateNextQuestion('React & Next.js', [
    { question: 'What is JSX?', answer: 'A syntax extension for JavaScript.' },
  ]);
  expect(typeof followUp).toBe('string');
  expect(followUp.length).toBeGreaterThan(0);

  // candidateName is sanitized and appended to the system prompt
  let captured: CapturedRequest | null = null;
  useChatHandler('Hi Alice, tell me about yourself.', (body) => (captured = body));

  const withName = await generateNextQuestion('React', [], undefined, 'Alice');
  expect(withName).toBe('Hi Alice, tell me about yourself.');
  expect(captured).not.toBeNull();
  expect(captured!.messages[0].content).toContain('Alice');

  // '!!!@@@' sanitizes to empty — name line must not appear in prompt
  useChatHandler('Tell me about your experience.', (body) => (captured = body));

  await generateNextQuestion('React', [], undefined, '!!!@@@');
  expect(captured).not.toBeNull();
  expect(captured!.messages[0].content).not.toContain("candidate's name is");

  // Empty LLM response
  useChatHandler('');
  await expect(generateNextQuestion('React', [])).rejects.toMatchObject({ type: 'unknown' });

  // Whitespace-only LLM response must also be rejected — otherwise the
  // session would advance with a blank question and the TTS would speak nothing.
  useChatHandler('   \n\t  ');
  await expect(generateNextQuestion('React', [])).rejects.toMatchObject({ type: 'unknown' });

  // 401 auth error
  server.use(
    http.post(`${BASE_URL}/chat/completions`, () => {
      return HttpResponse.json({ error: { message: 'Invalid API key' } }, { status: 401 });
    }),
  );
  await expect(generateNextQuestion('React', [])).rejects.toMatchObject({ type: 'auth' });
});

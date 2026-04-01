import { http, HttpResponse } from 'msw';

const BASE_URL = 'https://api.openai.com/v1';

export const handlers = [
  http.post(`${BASE_URL}/chat/completions`, () => {
    return HttpResponse.json({
      choices: [
        {
          message: {
            content: 'Can you explain the difference between == and === in JavaScript?',
          },
        },
      ],
    });
  }),

  http.post(`${BASE_URL}/audio/transcriptions`, () => {
    return HttpResponse.json({
      text: 'A closure is a function that captures variables from its outer scope.',
    });
  }),

  http.post(`${BASE_URL}/audio/speech`, () => {
    // Return a minimal valid mp3 header (silence)
    const buffer = new ArrayBuffer(8);
    return new HttpResponse(buffer, {
      headers: { 'Content-Type': 'audio/mpeg' },
    });
  }),
];

import { expect, test, vi } from 'vitest';
import { saveApiKey } from '@/db/apiKey/apiKey';

vi.mock('@/services/openai/openai', () => ({
  getOpenAIClient: vi.fn().mockResolvedValue({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'Mocked transcript from STT.' }),
      },
    },
  }),
}));

const { transcribeAudio } = await import('@/services/stt/stt');

test('transcribeAudio returns transcript text and throws classified errors', async () => {
  await saveApiKey('sk-test');
  const blob = new Blob(['fake audio'], { type: 'audio/webm' });

  // Happy path
  const transcript = await transcribeAudio(blob);
  expect(transcript).toBe('Mocked transcript from STT.');

  // Error path — mock a 429 error
  const { getOpenAIClient } = await import('@/services/openai/openai');
  vi.mocked(getOpenAIClient).mockResolvedValueOnce({
    audio: {
      transcriptions: {
        create: vi.fn().mockRejectedValue({ status: 429, message: 'Too many requests' }),
      },
    },
  } as never);

  await expect(transcribeAudio(blob)).rejects.toMatchObject({ type: 'rate_limit' });
});

import { expect, test, vi } from 'vitest';
import { platform } from '@/platform';
import { transcribeAudio } from '@/services/stt/stt';

// The OpenAI transcription request is multipart/form-data, which jsdom
// currently can't round-trip through MSW (file handling differs from the
// real browser fetch). We substitute at the next boundary up — the platform
// HTTP adapter — and assert on the user-observable outcomes rather than on
// invocation shape.
test('a recording round-trips into a transcript, and rate-limit responses surface as retryable', async ({
  onTestFinished,
}) => {
  const blob = new Blob(['fake audio'], { type: 'audio/webm' });

  const transcribe = vi
    .spyOn(platform.http.openai, 'transcribe')
    .mockResolvedValueOnce('A closure captures variables.')
    .mockRejectedValueOnce({ type: 'rate_limit', message: 'rate limited', retryable: true });
  onTestFinished(() => transcribe.mockRestore());

  expect(await transcribeAudio(blob)).toBe('A closure captures variables.');

  await expect(transcribeAudio(blob)).rejects.toMatchObject({ type: 'rate_limit' });
});

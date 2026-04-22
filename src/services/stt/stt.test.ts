import { expect, test, vi } from 'vitest';
import { platform } from '@/platform';
import { transcribeAudio } from '@/services/stt/stt';

test('transcribeAudio delegates to the platform HTTP adapter and propagates classified errors', async () => {
  const blob = new Blob(['fake audio'], { type: 'audio/webm' });

  const transcribe = vi
    .spyOn(platform.http.openai, 'transcribe')
    .mockResolvedValueOnce('A closure captures variables.')
    .mockRejectedValueOnce({ type: 'rate_limit', message: 'rate limited', retryable: true });

  const transcript = await transcribeAudio(blob);
  expect(transcript).toBe('A closure captures variables.');
  expect(transcribe).toHaveBeenCalledWith(
    expect.objectContaining({ audio: blob, filename: 'recording.webm' }),
    undefined,
  );

  await expect(transcribeAudio(blob)).rejects.toMatchObject({ type: 'rate_limit' });

  transcribe.mockRestore();
});

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

// Phase 9.2: when the recorder has been streaming chunks into a Rust-side
// buffer during the turn, the blob is already in Rust — the post-mic-stop
// transcribe path should commit the buffer instead of re-uploading the blob.
test('recordings streamed during the turn commit by id instead of re-uploading the blob', async ({
  onTestFinished,
}) => {
  const blob = new Blob(['fake audio'], { type: 'audio/webm' });
  const commit = vi.fn().mockResolvedValue('Server replied from the buffered upload.');
  const pushChunk = vi.fn().mockResolvedValue(undefined);
  const discard = vi.fn().mockResolvedValue(undefined);
  const fallbackTranscribe = vi.spyOn(platform.http.openai, 'transcribe');

  const original = platform.http.openai.transcribeStreaming;
  platform.http.openai.transcribeStreaming = { pushChunk, commit, discard };
  onTestFinished(() => {
    platform.http.openai.transcribeStreaming = original;
    fallbackTranscribe.mockRestore();
  });

  const transcript = await transcribeAudio(blob, undefined, 'req-123');
  expect(transcript).toBe('Server replied from the buffered upload.');
  expect(commit).toHaveBeenCalledTimes(1);
  const [commitArgs] = commit.mock.calls[0] as [Record<string, unknown>];
  expect(commitArgs.requestId).toBe('req-123');
  // Phase 9.3: the recorder streams raw 16kHz mono PCM chunks, so the
  // commit tells the backend to wrap them in a WAV header regardless of
  // what the recorder's fallback blob type was.
  expect(commitArgs.filename).toBe('recording.wav');
  expect(commitArgs.contentType).toBe('audio/wav');
  expect(commitArgs.sampleRate).toBe(16000);
  expect(typeof commitArgs.model).toBe('string');
  // Full-blob transcribe was NOT called — that's the point of 9.2.
  expect(fallbackTranscribe).not.toHaveBeenCalled();
});

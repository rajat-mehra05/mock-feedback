import { expect, test, vi } from 'vitest';
import { platform } from '@/platform';

// Both TTS halves are stubbed: fetchSpeech is the network side, playAudioArrayBuffer
// is the playback side. jsdom has no AudioContext so the real playback would throw.
vi.mock('@/services/tts/playback', () => ({
  playAudioArrayBuffer: vi.fn().mockResolvedValue(undefined),
}));

const { streamAndSpeakQuestion } = await import('./streamingQuestion');
const { playAudioArrayBuffer } = await import('@/services/tts/playback');

function streamOf(chunks: string[]): AsyncIterable<string> {
  let i = 0;
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () =>
          Promise.resolve(
            i < chunks.length
              ? { value: chunks[i++], done: false }
              : { value: undefined, done: true },
          ),
      };
    },
  };
}

test('streaming turn speaks each sentence as it completes and returns the full question', async () => {
  // Chat emits three chunks whose concatenation is two full sentences.
  const chatStream = vi
    .spyOn(platform.http.openai, 'chatStream')
    .mockReturnValue(
      streamOf([
        'Hello there candidate. ',
        'Can you describe the virtual DOM',
        ' and how React uses it?',
      ]),
    );
  const fetchSpeech = vi
    .spyOn(platform.http.openai, 'fetchSpeech')
    .mockResolvedValue(new ArrayBuffer(0));
  vi.mocked(playAudioArrayBuffer).mockClear();

  const textUpdates: string[] = [];
  const result = await streamAndSpeakQuestion({
    topic: 'React',
    history: [],
    onTextUpdate: (t) => textUpdates.push(t),
  });

  expect(result.text).toBe(
    'Hello there candidate. Can you describe the virtual DOM and how React uses it?',
  );
  expect(result.ttsFailed).toBe(false);

  // Two sentences — splitter emits the first at period+space, the second on flush.
  // Web path calls fetchSpeech per sentence and plays each buffer in order.
  const fetched = fetchSpeech.mock.calls.map(([req]) => req.input);
  expect(fetched).toEqual([
    'Hello there candidate.',
    'Can you describe the virtual DOM and how React uses it?',
  ]);
  expect(vi.mocked(playAudioArrayBuffer).mock.calls.length).toBe(2);

  // UI receives incremental text updates as chunks arrive.
  expect(textUpdates.length).toBeGreaterThanOrEqual(3);
  expect(textUpdates.at(-1)).toBe(result.text);

  chatStream.mockRestore();
  fetchSpeech.mockRestore();
});

test('tts failure after a valid chat completes flags ttsFailed instead of throwing', async () => {
  const chatStream = vi
    .spyOn(platform.http.openai, 'chatStream')
    .mockReturnValue(streamOf(['A short question for you. ', 'Explain Suspense in React.']));
  // First fetch succeeds; the second one blows up. ttsFailed should be true
  // but the chat text still returns cleanly.
  const fetchSpeech = vi
    .spyOn(platform.http.openai, 'fetchSpeech')
    .mockResolvedValueOnce(new ArrayBuffer(0))
    .mockRejectedValueOnce(new Error('audio device unavailable'));
  vi.mocked(playAudioArrayBuffer).mockReset().mockResolvedValue(undefined);

  const result = await streamAndSpeakQuestion({ topic: 'React', history: [] });

  expect(result.ttsFailed).toBe(true);
  expect(result.text).toBe('A short question for you. Explain Suspense in React.');

  chatStream.mockRestore();
  fetchSpeech.mockRestore();
});

test('chat-stream error aborts the turn and is rethrown as a classified error', async () => {
  const failingStream: AsyncIterable<string> = {
    [Symbol.asyncIterator]() {
      let sent = false;
      return {
        next: () => {
          if (!sent) {
            sent = true;
            return Promise.resolve({ value: 'This will never ', done: false });
          }
          return Promise.reject(new Error('offline'));
        },
      };
    },
  };
  const chatStream = vi.spyOn(platform.http.openai, 'chatStream').mockReturnValue(failingStream);
  const fetchSpeech = vi
    .spyOn(platform.http.openai, 'fetchSpeech')
    .mockResolvedValue(new ArrayBuffer(0));
  vi.mocked(playAudioArrayBuffer).mockReset().mockResolvedValue(undefined);

  await expect(streamAndSpeakQuestion({ topic: 'React', history: [] })).rejects.toMatchObject({
    type: 'unknown',
  });

  chatStream.mockRestore();
  fetchSpeech.mockRestore();
});

test('empty chat stream throws a classified error instead of resolving with blank text', async () => {
  const chatStream = vi.spyOn(platform.http.openai, 'chatStream').mockReturnValue(streamOf(['']));
  const fetchSpeech = vi
    .spyOn(platform.http.openai, 'fetchSpeech')
    .mockResolvedValue(new ArrayBuffer(0));
  vi.mocked(playAudioArrayBuffer).mockReset().mockResolvedValue(undefined);

  await expect(streamAndSpeakQuestion({ topic: 'React', history: [] })).rejects.toMatchObject({
    type: 'unknown',
  });

  chatStream.mockRestore();
  fetchSpeech.mockRestore();
});

test('sentence N+1 fetch is pipelined in parallel with sentence N playback', async () => {
  const chatStream = vi
    .spyOn(platform.http.openai, 'chatStream')
    .mockReturnValue(streamOf(['First sentence here. ', 'Second sentence here.']));

  /*
    Hold sentence 1's audio deferred so the consumer can't finish playing it.
    Sentence 2's fetch must still be kicked off (pipeline lookahead).
  */
  let resolveS1!: (buf: ArrayBuffer) => void;
  const s1Deferred = new Promise<ArrayBuffer>((resolve) => {
    resolveS1 = resolve;
  });
  const fetchSpeech = vi
    .spyOn(platform.http.openai, 'fetchSpeech')
    .mockReturnValueOnce(s1Deferred)
    .mockResolvedValueOnce(new ArrayBuffer(0));
  vi.mocked(playAudioArrayBuffer).mockReset().mockResolvedValue(undefined);

  const pending = streamAndSpeakQuestion({ topic: 'React', history: [] });

  await vi.waitFor(() => {
    expect(fetchSpeech.mock.calls.length).toBe(2);
  });
  expect(vi.mocked(playAudioArrayBuffer).mock.calls.length).toBe(0);

  resolveS1(new ArrayBuffer(0));
  const result = await pending;
  expect(result.text).toBe('First sentence here. Second sentence here.');
  expect(result.ttsFailed).toBe(false);
  expect(vi.mocked(playAudioArrayBuffer).mock.calls.length).toBe(2);

  chatStream.mockRestore();
  fetchSpeech.mockRestore();
});

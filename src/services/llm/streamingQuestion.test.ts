import { expect, test, vi } from 'vitest';
import { platform } from '@/platform';

vi.mock('@/services/tts/tts', () => ({
  speakText: vi.fn().mockResolvedValue(undefined),
}));

const { streamAndSpeakQuestion } = await import('./streamingQuestion');
const { speakText } = await import('@/services/tts/tts');

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
  vi.mocked(speakText).mockClear();

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

  // Two sentences — the splitter emits the first at the period+space boundary
  // and the second on flush. TTS is invoked once per sentence, in order.
  const spoken = vi.mocked(speakText).mock.calls.map(([text]) => text);
  expect(spoken).toEqual([
    'Hello there candidate.',
    'Can you describe the virtual DOM and how React uses it?',
  ]);

  // UI receives incremental text updates as chunks arrive.
  expect(textUpdates.length).toBeGreaterThanOrEqual(3);
  expect(textUpdates.at(-1)).toBe(result.text);

  chatStream.mockRestore();
});

test('tts failure after a valid chat completes flags ttsFailed instead of throwing', async () => {
  const chatStream = vi
    .spyOn(platform.http.openai, 'chatStream')
    .mockReturnValue(streamOf(['A short question for you. ', 'Explain Suspense in React.']));
  // First sentence speaks fine; the second one blows up.
  vi.mocked(speakText)
    .mockReset()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('audio device unavailable'));

  const result = await streamAndSpeakQuestion({ topic: 'React', history: [] });

  expect(result.ttsFailed).toBe(true);
  expect(result.text).toBe('A short question for you. Explain Suspense in React.');

  chatStream.mockRestore();
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
  vi.mocked(speakText).mockReset().mockResolvedValue(undefined);

  await expect(streamAndSpeakQuestion({ topic: 'React', history: [] })).rejects.toMatchObject({
    type: 'unknown',
  });

  chatStream.mockRestore();
});

test('empty chat stream throws a classified error instead of resolving with blank text', async () => {
  const chatStream = vi.spyOn(platform.http.openai, 'chatStream').mockReturnValue(streamOf(['']));
  vi.mocked(speakText).mockReset().mockResolvedValue(undefined);

  await expect(streamAndSpeakQuestion({ topic: 'React', history: [] })).rejects.toMatchObject({
    type: 'unknown',
  });

  chatStream.mockRestore();
});

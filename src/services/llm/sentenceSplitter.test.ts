import { expect, test } from 'vitest';
import { SentenceAccumulator } from './sentenceSplitter';

test('candidate listens to a streaming question arrive sentence by sentence', () => {
  const acc = new SentenceAccumulator();

  // First chunk: opening of the question, no terminator yet.
  expect(acc.push('That is a great answer about hooks.')).toEqual([]);
  // Terminator + whitespace at the boundary of the next chunk emits sentence 1.
  expect(acc.push(' Now tell me about useEffect and its dependency array.')).toEqual([
    'That is a great answer about hooks.',
  ]);
  // The trailing sentence without any more input only comes out on flush.
  expect(acc.flush()).toBe('Now tell me about useEffect and its dependency array.');
});

test('abbreviations and decimals inside a sentence do not cause premature splits', () => {
  const acc = new SentenceAccumulator();
  // `Dr.` and `1.5` both sit under the MIN_SENTENCE_CHARS guard, so the first
  // sentence is only emitted at the real period after "experience".
  const emitted = acc.push('Dr. Smith has 1.5 years of React experience. ');
  expect(emitted).toEqual(['Dr. Smith has 1.5 years of React experience.']);
  expect(acc.flush()).toBeNull();
});

test('streaming tokens arriving one character at a time split correctly at boundaries', () => {
  const acc = new SentenceAccumulator();
  const text = 'Tell me about closures. What is hoisting?';
  const emitted: string[] = [];

  for (const ch of text) {
    emitted.push(...acc.push(ch));
  }
  const tail = acc.flush();
  if (tail) emitted.push(tail);

  expect(emitted).toEqual(['Tell me about closures.', 'What is hoisting?']);
});

test('consecutive terminators like "..." are treated as a single boundary', () => {
  const acc = new SentenceAccumulator();
  const emitted = acc.push('Well... let me think about that carefully. ');
  expect(emitted).toEqual(['Well... let me think about that carefully.']);
  expect(acc.flush()).toBeNull();
});

test('flush recovers a final sentence that never got a trailing space', () => {
  const acc = new SentenceAccumulator();
  acc.push('What is the virtual DOM and how does React use it');
  // No terminator yet, nothing emitted.
  expect(acc.flush()).toBe('What is the virtual DOM and how does React use it');
});

test('empty input produces no sentences and a null flush', () => {
  const acc = new SentenceAccumulator();
  expect(acc.push('')).toEqual([]);
  expect(acc.flush()).toBeNull();
});

test('short acknowledgments at or above the 8-char guard split early so TTS starts sooner', () => {
  // "Exactly!" is exactly 8 chars and sits at the threshold. Emitting early
  // is the whole point of 9.1 — the acknowledgment starts playing while the
  // model is still generating the actual question.
  const acc = new SentenceAccumulator();
  expect(acc.push('Exactly! Now describe useState and its return value. ')).toEqual([
    'Exactly!',
    'Now describe useState and its return value.',
  ]);
  expect(acc.flush()).toBeNull();
});

test('terminators inside very short fragments stay merged with the next sentence', () => {
  // "Hi!" is 3 chars — under the guard, so we don't split here. It gets
  // glued to the following full question. Same rule that protects `Dr.`.
  const acc = new SentenceAccumulator();
  const emitted = acc.push('Hi! Tell me about your React background. ');
  expect(emitted).toEqual(['Hi! Tell me about your React background.']);
  expect(acc.flush()).toBeNull();
});

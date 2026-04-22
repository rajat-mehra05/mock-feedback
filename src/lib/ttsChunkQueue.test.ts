import { expect, test } from 'vitest';
import { TtsChunkQueue } from './ttsChunkQueue';

function bytes(...values: number[]): Uint8Array {
  return new Uint8Array(values);
}

test('chunks flow FIFO and canEndStream flips true only after end and a complete drain', () => {
  const q = new TtsChunkQueue();
  q.push(bytes(1));
  q.push(bytes(2));
  q.push(bytes(3));

  // Still open, more chunks might arrive — bridge must not call endOfStream.
  expect(q.canEndStream()).toBe(false);

  // User said "no more" but the queue still has data to append.
  q.end();
  expect(q.isClosed).toBe(true);
  expect(q.canEndStream()).toBe(false);

  // Drain in FIFO order.
  expect(q.nextChunk()).toEqual(bytes(1));
  expect(q.nextChunk()).toEqual(bytes(2));
  expect(q.canEndStream()).toBe(false); // still one left
  expect(q.nextChunk()).toEqual(bytes(3));

  // Empty + closed → bridge may call mediaSource.endOfStream() now.
  expect(q.canEndStream()).toBe(true);
  expect(q.nextChunk()).toBeUndefined();
});

test('push and end are no-ops once the queue has been ended — late chunks cannot smuggle through', () => {
  const q = new TtsChunkQueue();
  q.push(bytes(1));
  q.end();

  q.push(bytes(99)); // must be dropped
  q.end(); // idempotent

  expect(q.size).toBe(1);
  expect(q.nextChunk()).toEqual(bytes(1));
  expect(q.nextChunk()).toBeUndefined();
});

test('fail drains the queue and blocks all further operations so the bridge sees a clean terminal state', () => {
  const q = new TtsChunkQueue();
  q.push(bytes(1));
  q.push(bytes(2));
  q.fail();

  // Existing chunks are dropped — the bridge is tearing down the audio
  // graph; finishing the append loop would be wasted work.
  expect(q.isErrored).toBe(true);
  expect(q.nextChunk()).toBeUndefined();
  expect(q.size).toBe(0);

  // Subsequent lifecycle calls can't un-error or re-queue.
  q.push(bytes(3));
  q.end();
  q.fail();
  expect(q.isErrored).toBe(true);
  expect(q.nextChunk()).toBeUndefined();
  // canEndStream must stay false — an errored stream should NOT be ended
  // normally, it should be aborted.
  expect(q.canEndStream()).toBe(false);
});

test('fail wins over end — a failure after a successful end still marks the queue errored', () => {
  // Scenario: end() was called, drain in progress, then audio element errors.
  // The bridge calls fail(); terminal state must reflect the error, not
  // "happily ended".
  const q = new TtsChunkQueue();
  q.push(bytes(1));
  q.end();
  q.fail();

  expect(q.isErrored).toBe(true);
  expect(q.canEndStream()).toBe(false);
  expect(q.nextChunk()).toBeUndefined();
});

test('empty lifecycle: end before any push yields an immediately terminatable stream', () => {
  // Edge case: a TTS call that produced no audio at all (OpenAI returned
  // an empty response). The bridge should call endOfStream right away so
  // the MediaSource doesn't hang.
  const q = new TtsChunkQueue();
  q.end();

  expect(q.canEndStream()).toBe(true);
  expect(q.nextChunk()).toBeUndefined();
});

import { expect, test, vi } from 'vitest';
import { withRetry } from '@/lib/retry';

test('withRetry retries retryable errors until success, stops on non-retryable, and exhausts attempts', async () => {
  // Pin Math.random to 1 so equal-jitter delay hits the backoff ceiling (deterministic).
  const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(1);

  // Succeeds on second attempt after a retryable failure
  const retryable = vi
    .fn()
    .mockRejectedValueOnce({ type: 'rate_limit', message: 'busy', retryable: true })
    .mockResolvedValueOnce('ok');

  vi.useFakeTimers();
  const successPromise = withRetry(retryable, {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 400,
  });
  await vi.advanceTimersByTimeAsync(100);
  expect(await successPromise).toBe('ok');
  expect(retryable).toHaveBeenCalledTimes(2);
  vi.useRealTimers();

  // Stops immediately on non-retryable error — no delay, single call
  const nonRetryable = vi
    .fn()
    .mockRejectedValueOnce({ type: 'auth', message: 'bad key', retryable: false });

  await expect(
    withRetry(nonRetryable, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 400 }),
  ).rejects.toMatchObject({ type: 'auth' });
  expect(nonRetryable).toHaveBeenCalledTimes(1);

  // Throws after exhausting all attempts
  const error = { type: 'rate_limit', message: 'busy', retryable: true };
  const exhausted = vi.fn().mockRejectedValueOnce(error).mockRejectedValueOnce(error);

  await expect(
    withRetry(exhausted, { maxAttempts: 2, baseDelayMs: 1, maxDelayMs: 1 }),
  ).rejects.toMatchObject({ type: 'rate_limit' });
  expect(exhausted).toHaveBeenCalledTimes(2);

  randomSpy.mockRestore();
});

test('withRetry respects abort signal: pre-aborted and mid-delay abort', async () => {
  const error = { type: 'rate_limit', message: 'busy', retryable: true };

  // Pre-aborted signal stops after first call
  const aborted = new AbortController();
  aborted.abort();
  const fn1 = vi.fn().mockRejectedValueOnce(error);

  await expect(
    withRetry(fn1, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 400, signal: aborted.signal }),
  ).rejects.toMatchObject({ type: 'rate_limit' });
  expect(fn1).toHaveBeenCalledTimes(1);

  // Abort during delay stops the retry loop
  const controller = new AbortController();
  const fn2 = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('should not reach');

  const promise = withRetry(fn2, {
    maxAttempts: 3,
    baseDelayMs: 5000,
    maxDelayMs: 5000,
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 10);

  await expect(promise).rejects.toMatchObject({ type: 'rate_limit' });
  expect(fn2).toHaveBeenCalledTimes(1);
});

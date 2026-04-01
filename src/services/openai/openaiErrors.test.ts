import { expect, test, vi } from 'vitest';
import { classifyOpenAIError, createTimeoutSignal } from '@/services/openai/openaiErrors';

test('classifyOpenAIError maps status codes and error types to normalized errors', () => {
  // 401 → auth
  const auth = classifyOpenAIError({ status: 401, message: 'Unauthorized' });
  expect(auth.type).toBe('auth');
  expect(auth.retryable).toBe(false);

  // 429 with quota message → quota (not retryable)
  const quota = classifyOpenAIError({ status: 429, message: 'You exceeded your quota' });
  expect(quota.type).toBe('quota');
  expect(quota.retryable).toBe(false);

  // 429 with billing message → quota
  const billing = classifyOpenAIError({ status: 429, message: 'Billing limit reached' });
  expect(billing.type).toBe('quota');

  // 429 without quota/billing → rate_limit (retryable)
  const rateLimit = classifyOpenAIError({ status: 429, message: 'Too many requests' });
  expect(rateLimit.type).toBe('rate_limit');
  expect(rateLimit.retryable).toBe(true);

  // 404 → not_found
  const notFound = classifyOpenAIError({ status: 404, message: 'Not found' });
  expect(notFound.type).toBe('not_found');
  expect(notFound.retryable).toBe(false);

  // AbortError → timeout (retryable)
  const abort = classifyOpenAIError(new DOMException('Aborted', 'AbortError'));
  expect(abort.type).toBe('timeout');
  expect(abort.retryable).toBe(true);

  // TypeError → network
  const network = classifyOpenAIError(new TypeError('Failed to fetch'));
  expect(network.type).toBe('network');
  expect(network.retryable).toBe(false);

  // Unknown error → unknown with original message
  const unknown = classifyOpenAIError({ status: 500, message: 'Internal server error' });
  expect(unknown.type).toBe('unknown');
  expect(unknown.message).toBe('Internal server error');
  expect(unknown.status).toBe(500);

  // Already-classified error passes through unchanged
  const existing = { type: 'auth' as const, message: 'test', retryable: false };
  expect(classifyOpenAIError(existing)).toBe(existing);
});

test('createTimeoutSignal merges timeout with caller signal and cleans up', () => {
  // Basic timeout signal
  const { signal, cleanup } = createTimeoutSignal(5000);
  expect(signal.aborted).toBe(false);
  cleanup();

  // Caller abort propagates to merged signal
  const controller = new AbortController();
  const { signal: merged } = createTimeoutSignal(5000, controller.signal);
  expect(merged.aborted).toBe(false);
  controller.abort();
  expect(merged.aborted).toBe(true);

  // Timeout fires and aborts the signal
  vi.useFakeTimers();
  const { signal: timedSignal, cleanup: timedCleanup } = createTimeoutSignal(100);
  expect(timedSignal.aborted).toBe(false);
  vi.advanceTimersByTime(100);
  expect(timedSignal.aborted).toBe(true);
  timedCleanup();
  vi.useRealTimers();

  // Cleanup prevents timeout from firing
  vi.useFakeTimers();
  const { signal: cleanedSignal, cleanup: earlyCleanup } = createTimeoutSignal(100);
  earlyCleanup();
  vi.advanceTimersByTime(200);
  expect(cleanedSignal.aborted).toBe(false);
  vi.useRealTimers();
});

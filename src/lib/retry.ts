import type { OpenAIServiceError } from '@/services/types';

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  signal?: AbortSignal;
}

export async function withRetry<T>(
  fn: (signal?: AbortSignal) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, signal } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn(signal);
    } catch (error) {
      const isRetryable = (error as OpenAIServiceError).retryable === true;
      const isLastAttempt = attempt === maxAttempts - 1;

      if (!isRetryable || isLastAttempt) throw error;
      if (signal?.aborted) throw error;

      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, delay);
        if (signal) {
          signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true },
          );
        }
      });
      if (signal?.aborted) throw error;
    }
  }

  throw new Error('withRetry: unreachable');
}

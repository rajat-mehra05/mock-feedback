import { APIConnectionError, APIConnectionTimeoutError } from 'openai';
import type { OpenAIServiceError } from '@/services/types';

const KNOWN_TYPES = new Set([
  'auth',
  'quota',
  'rate_limit',
  'not_found',
  'network',
  'timeout',
  'unknown',
]);

export function classifyOpenAIError(error: unknown): OpenAIServiceError {
  // Pass through already-classified OpenAIServiceError
  if (
    error &&
    typeof error === 'object' &&
    'type' in error &&
    KNOWN_TYPES.has((error as { type: string }).type)
  ) {
    return error as OpenAIServiceError;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return { type: 'timeout', message: 'Request timed out.', retryable: true };
  }

  // OpenAI SDK wraps fetch failures in APIConnectionTimeoutError / APIConnectionError.
  // These are transient and should be retried.
  // NOTE: Timeout check must come first — APIConnectionTimeoutError extends APIConnectionError.
  if (error instanceof APIConnectionTimeoutError) {
    return { type: 'timeout', message: 'Request timed out.', retryable: true };
  }

  if (error instanceof APIConnectionError) {
    return {
      type: 'network',
      message: 'Connection error. Check your internet connection and try again.',
      retryable: true,
    };
  }

  if (error instanceof TypeError) {
    return {
      type: 'network',
      message: 'Network error. Check your internet connection.',
      retryable: false,
    };
  }

  const status = (error as { status?: number }).status;
  const msg = (error as { message?: string }).message ?? 'An unexpected error occurred.';

  if (status === 401) {
    return {
      type: 'auth',
      message: 'Your API key is invalid. Please update it in Settings.',
      status,
      retryable: false,
    };
  }

  if (status === 429) {
    const isQuota = msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('billing');
    return isQuota
      ? {
          type: 'quota',
          message: 'Your OpenAI API quota is exhausted. Please add credits.',
          status,
          retryable: false,
        }
      : {
          type: 'rate_limit',
          message: 'Rate limited. Please wait a moment and try again.',
          status,
          retryable: true,
        };
  }

  if (status === 404) {
    return {
      type: 'not_found',
      message: 'The required AI model is not available on your OpenAI account.',
      status,
      retryable: false,
    };
  }

  return { type: 'unknown', message: msg, status, retryable: false };
}

/**
 * Merges a per-call timeout with an optional caller AbortSignal.
 * Returns the merged signal and a cleanup function to clear the timer.
 */
export function createTimeoutSignal(
  timeoutMs: number,
  existingSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } {
  const timeoutController = new AbortController();
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);

  const signals = [timeoutController.signal];
  if (existingSignal) signals.push(existingSignal);

  return {
    signal: AbortSignal.any(signals),
    cleanup: () => clearTimeout(timer),
  };
}

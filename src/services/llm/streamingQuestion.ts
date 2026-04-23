import { platform } from '@/platform';
import { LLM_MAX_TOKENS, LLM_MODEL, LLM_TEMPERATURE } from '@/constants/openai';
import { buildInterviewPrompt } from '@/constants/prompts';
import { classifyOpenAIError } from '@/services/openai/openaiErrors';
import { speakText } from '@/services/tts/tts';
import { mark } from '@/lib/perf';
import type { ConversationTurn } from '@/services/types';
import { SentenceAccumulator } from './sentenceSplitter';

// Stream the next interview question and speak it sentence by sentence,
// overlapping TTS with the rest of the LLM response. Resolves once both
// chat streaming and all sentence playback have completed.
export interface StreamingQuestionOptions {
  topic: string;
  history: ConversationTurn[];
  candidateName?: string;
  /** Fires every time the accumulated text grows, so the UI can display the
   *  question as it streams in rather than waiting for chat_end. */
  onTextUpdate?: (fullText: string) => void;
  signal?: AbortSignal;
}

export interface StreamingQuestionResult {
  /** Full question text, with leading/trailing whitespace trimmed. */
  text: string;
  /** True if the chat stream completed but at least one TTS sentence failed.
   *  Callers should surface the text as fallback (ttsFallbackText) and let the
   *  user continue without re-throwing. Chat errors are always thrown. */
  ttsFailed: boolean;
}

export async function streamAndSpeakQuestion(
  opts: StreamingQuestionOptions,
): Promise<StreamingQuestionResult> {
  const { topic, history, candidateName, onTextUpdate, signal } = opts;
  const systemPrompt = buildInterviewPrompt({ topic, candidateName });
  const messages: Array<{ role: 'system' | 'assistant' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.flatMap((turn) => [
      { role: 'assistant' as const, content: turn.question },
      { role: 'user' as const, content: turn.answer },
    ]),
  ];

  // Internal controller lets a mid-stream failure on either side (chat or TTS)
  // tear down both halves in sync.
  const ctrl = new AbortController();
  const turnSignal = signal ? AbortSignal.any([signal, ctrl.signal]) : ctrl.signal;

  const splitter = new SentenceAccumulator();
  const queue: string[] = [];
  let chatDone = false;
  let wake: (() => void) | null = null;
  const notify = () => {
    if (wake) {
      const w = wake;
      wake = null;
      w();
    }
  };

  let fullText = '';
  let firstTokenSeen = false;

  // Consumer: speak sentences one at a time, in order. Sequential playback
  // matches the existing TTS UX (one voice at a time) and avoids overlap.
  const consumerPromise = (async () => {
    while (true) {
      if (turnSignal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (queue.length > 0) {
        const sentence = queue.shift()!;
        await speakText(sentence, turnSignal);
        continue;
      }
      if (chatDone) return;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  })();
  // If speakText rejects while the chat-side for-await is still pumping, the
  // rejection is in flight but no handler is attached yet. Node/vitest flag
  // that as an unhandled rejection. Attach a no-op catch to mark it handled;
  // `await consumerPromise` below still propagates the original error state.
  consumerPromise.catch(() => {});

  let chatError: unknown = null;
  try {
    mark('chat_start');
    for await (const chunk of platform.http.openai.chatStream(
      { model: LLM_MODEL, messages, temperature: LLM_TEMPERATURE, maxTokens: LLM_MAX_TOKENS },
      turnSignal,
    )) {
      // Defensive: adapters should filter empty deltas, but if one slips
      // through we don't want it to trip `first_token` before real text.
      if (!chunk) continue;
      if (!firstTokenSeen) {
        mark('first_token');
        firstTokenSeen = true;
      }
      fullText += chunk;
      onTextUpdate?.(fullText);
      for (const sentence of splitter.push(chunk)) {
        queue.push(sentence);
        notify();
      }
    }
    mark('last_token');
    const tail = splitter.flush();
    if (tail) {
      queue.push(tail);
      notify();
    }
  } catch (error) {
    chatError = error;
    ctrl.abort();
  } finally {
    mark('chat_end');
    chatDone = true;
    notify();
  }

  let ttsFailed = false;
  try {
    await consumerPromise;
  } catch (consumerError) {
    // Chat errors take precedence; if chat already failed, the consumer's
    // cascade error is noise. Otherwise re-throw aborts (user cancelled) and
    // treat any other TTS failure as soft so the text fallback still renders.
    if (!chatError) {
      if (isAbortError(consumerError)) throw consumerError;
      ttsFailed = true;
    }
  }

  if (chatError) {
    // Once TTS has started speaking sentence 1, a retry would play the
    // question's audio a second time. Force `retryable: false` on any error
    // that happened after the first token arrived so `withRetry` bails out.
    const classified = classifyOpenAIError(chatError);
    if (firstTokenSeen) classified.retryable = false;
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- classified error
    throw classified;
  }

  const trimmed = fullText.trim();
  if (!trimmed) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- classified error
    throw classifyOpenAIError(new Error('Empty interview question generated by LLM'));
  }
  return { text: trimmed, ttsFailed };
}

function isAbortError(error: unknown): boolean {
  // Duck-type on `.name` rather than `instanceof Error` so aborts that crossed
  // a realm boundary (workers, iframes, jsdom's separate realm in tests) still
  // match. Any object with `name === 'AbortError'` counts.
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}

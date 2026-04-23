import { platform } from '@/platform';
import {
  LLM_MAX_TOKENS,
  LLM_MODEL,
  LLM_TEMPERATURE,
  TTS_MODEL,
  TTS_VOICE,
  TTS_INSTRUCTIONS,
  TTS_RESPONSE_FORMAT,
} from '@/constants/openai';
import { buildInterviewPrompt } from '@/constants/prompts';
import { classifyOpenAIError } from '@/services/openai/openaiErrors';
import { speakText } from '@/services/tts/tts';
import { playAudioArrayBuffer } from '@/services/tts/playback';
import { mark } from '@/lib/perf';
import type { ConversationTurn } from '@/services/types';
import { SentenceAccumulator } from './sentenceSplitter';

/*
  Streams the next interview question and speaks it sentence by sentence,
  overlapping TTS with the rest of the LLM response.
*/
export interface StreamingQuestionOptions {
  topic: string;
  history: ConversationTurn[];
  candidateName?: string;
  /**
    Fires every time the accumulated text grows, so the UI can display the
    question as it streams in rather than waiting for chat_end.
  */
  onTextUpdate?: (fullText: string) => void;
  signal?: AbortSignal;
}

export interface StreamingQuestionResult {
  /** Full question text, with leading/trailing whitespace trimmed. */
  text: string;
  /**
    True if the chat stream completed but at least one TTS sentence failed.
    Callers should surface the text as fallback (ttsFallbackText) and let the
    user continue without re-throwing. Chat errors are always thrown.
  */
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

  /*
    Internal controller lets a mid-stream failure on either side (chat or TTS)
    tear down both halves in sync.
  */
  const ctrl = new AbortController();
  const turnSignal = signal ? AbortSignal.any([signal, ctrl.signal]) : ctrl.signal;

  const splitter = new SentenceAccumulator();
  const sentenceQueue: string[] = [];
  const audioQueue: Promise<ArrayBuffer>[] = [];
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

  /*
    Web: kick off each sentence's TTS fetch as soon as the splitter emits it, so
    sentence N+1 is already downloading while sentence N plays. Tauri has no
    fetchSpeech and keeps the sequential speakText path.
  */
  const fetchSpeech = platform.http.openai.fetchSpeech;
  const enqueueSentence = (sentence: string): void => {
    if (fetchSpeech) {
      const p = fetchSpeech(
        {
          model: TTS_MODEL,
          voice: TTS_VOICE,
          input: sentence,
          instructions: TTS_INSTRUCTIONS,
          responseFormat: TTS_RESPONSE_FORMAT,
        },
        turnSignal,
      );
      /*
        Mark handled so an early rejection isn't flagged as unhandled. The
        consumer still observes the rejection when it awaits this promise.
      */
      p.catch(() => {});
      audioQueue.push(p);
    } else {
      sentenceQueue.push(sentence);
    }
    notify();
  };

  const consumerPromise = (async () => {
    if (!fetchSpeech) {
      while (true) {
        if (turnSignal.aborted) throw new DOMException('Aborted', 'AbortError');
        if (sentenceQueue.length > 0) {
          await speakText(sentenceQueue.shift()!, turnSignal);
          continue;
        }
        if (chatDone) return;
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
      }
    }

    while (true) {
      if (turnSignal.aborted) throw new DOMException('Aborted', 'AbortError');
      if (audioQueue.length > 0) {
        const buffer = await audioQueue.shift()!;
        mark('tts_start');
        try {
          await playAudioArrayBuffer(buffer, turnSignal);
        } finally {
          mark('playback_end');
        }
        continue;
      }
      if (chatDone) return;
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  })();
  /*
    Marks any early consumer rejection as handled while chat still pumps.
    The `await consumerPromise` below still surfaces the real error.
  */
  consumerPromise.catch(() => {});

  let chatError: unknown = null;
  try {
    mark('chat_start');
    for await (const chunk of platform.http.openai.chatStream(
      { model: LLM_MODEL, messages, temperature: LLM_TEMPERATURE, maxTokens: LLM_MAX_TOKENS },
      turnSignal,
    )) {
      /*
        Defensive: drop empty deltas so they don't trip `first_token`
        before the first real token arrives.
      */
      if (!chunk) continue;
      if (!firstTokenSeen) {
        mark('first_token');
        firstTokenSeen = true;
      }
      fullText += chunk;
      onTextUpdate?.(fullText);
      for (const sentence of splitter.push(chunk)) {
        enqueueSentence(sentence);
      }
    }
    mark('last_token');
    const tail = splitter.flush();
    if (tail) {
      enqueueSentence(tail);
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
    /*
      Chat errors take precedence. Re-throw user aborts; treat other TTS
      failures as soft so the text fallback renders.
    */
    if (!chatError) {
      if (isAbortError(consumerError)) throw consumerError;
      ttsFailed = true;
    }
  }

  if (chatError) {
    /*
      After the first token, a retry would replay already-spoken audio.
      Force retryable:false so withRetry bails out.
    */
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
  /*
    Duck-type on .name so AbortErrors from other realms (workers, jsdom) still
    match. Any object with name === 'AbortError' counts.
  */
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name: unknown }).name === 'AbortError'
  );
}

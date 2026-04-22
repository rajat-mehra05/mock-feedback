import { invoke, Channel } from '@tauri-apps/api/core';
import type { ChatRequest, OpenAIHttpAdapter, TranscribeRequest, TtsRequest } from '../../types';
import { classifyOpenAIError } from '@/services/openai/openaiErrors';
import { playMediaSourceStream } from './ttsPlayback';

interface ChatArgs {
  requestId: string;
  request: {
    model: string;
    messages: ChatRequest['messages'];
    temperature?: number;
    maxTokens?: number;
  };
}

interface TtsStartArgs {
  requestId: string;
  request: {
    model: string;
    voice: string;
    input: string;
    instructions?: string;
    responseFormat?: string;
  };
}

// TTS channel delivers raw mp3 chunks as ArrayBuffer and control events
// (done / error) as parsed JSON. See Phase 9 binary-IPC note in
// src-tauri/src/commands/openai.rs.
type TtsMessage = ArrayBuffer | { kind: 'done' } | { kind: 'error'; message: string };

function newRequestId(): string {
  return crypto.randomUUID();
}

async function cancel(requestId: string): Promise<void> {
  try {
    await invoke('cancel_request', { requestId });
  } catch {
    // Best-effort cancel; ignore if the request has already completed.
  }
}

function bindAbort(signal: AbortSignal | undefined, requestId: string): () => void {
  if (!signal) return () => {};
  const handler = () => {
    void cancel(requestId);
  };
  if (signal.aborted) {
    void cancel(requestId);
    return () => {};
  }
  signal.addEventListener('abort', handler, { once: true });
  return () => signal.removeEventListener('abort', handler);
}

export const tauriOpenAIHttp: OpenAIHttpAdapter = {
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<string> {
    const requestId = newRequestId();
    const unbind = bindAbort(signal, requestId);
    try {
      return await invoke<string>('openai_chat', {
        args: {
          requestId,
          request: {
            model: req.model,
            messages: req.messages,
            temperature: req.temperature,
            maxTokens: req.maxTokens,
          },
        } satisfies ChatArgs,
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- classified error
      throw classifyOpenAIError(toOpenAIError(error));
    } finally {
      unbind();
    }
  },

  chatStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<string> {
    return tauriChatStream(req, signal);
  },

  async transcribe(req: TranscribeRequest, signal?: AbortSignal): Promise<string> {
    const requestId = newRequestId();
    const unbind = bindAbort(signal, requestId);
    try {
      const buf = new Uint8Array(await req.audio.arrayBuffer());
      // Raw body + metadata in headers. JSON-wrapped number[] expanded the
      // payload ~4x and added 50-100ms of parse cost on a 1MB upload.
      return await invoke<string>('openai_transcribe', buf, {
        headers: {
          'x-request-id': requestId,
          'x-model': req.model,
          'x-filename': req.filename ?? 'recording.webm',
          'x-content-type': req.audio.type || 'application/octet-stream',
        },
      });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- classified error
      throw classifyOpenAIError(toOpenAIError(error));
    } finally {
      unbind();
    }
  },

  async speak(req: TtsRequest, signal?: AbortSignal): Promise<void> {
    const requestId = newRequestId();
    const unbind = bindAbort(signal, requestId);
    const channel = new Channel<TtsMessage>();
    const stream = playMediaSourceStream(signal);
    channel.onmessage = (event) => {
      if (event instanceof ArrayBuffer) {
        stream.push(new Uint8Array(event));
      } else if (event.kind === 'done') {
        stream.end();
      } else {
        stream.fail(new Error(event.message));
      }
    };
    try {
      await invoke('openai_tts', {
        args: {
          requestId,
          request: {
            model: req.model,
            voice: req.voice,
            input: req.input,
            instructions: req.instructions,
            responseFormat: req.responseFormat,
          },
        } satisfies TtsStartArgs,
        channel,
      });
      await stream.finished;
    } catch (error) {
      stream.fail(error instanceof Error ? error : new Error('tts failed'));
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- classified error
      throw classifyOpenAIError(toOpenAIError(error));
    } finally {
      unbind();
    }
  },
};

type ChatDelta =
  | { kind: 'content'; text: string }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

/**
 * Bridges Tauri's callback-style `Channel<ChatDelta>` to an async iterator of
 * text chunks. Each delta is pushed onto a buffer; readers await a signal when
 * the buffer is empty. Terminal events (done / error / abort) close the stream.
 */
async function* tauriChatStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<string> {
  const requestId = newRequestId();
  const unbind = bindAbort(signal, requestId);
  const channel = new Channel<ChatDelta>();

  const buffered: string[] = [];
  // `error` is `unknown` because `classifyOpenAIError` returns a plain object
  // (not an `Error` instance); `throw` accepts any value, so re-throwing is
  // fine. Wrapped in `state.terminal` so TS re-reads the property on each
  // access — `let terminal` gets narrowed to `null` under `tsc -b` because
  // every assignment happens inside a callback closure.
  const state: { terminal: { done: true } | { error: unknown } | null } = { terminal: null };
  let wake: (() => void) | null = null;
  const notify = () => {
    if (wake) {
      const w = wake;
      wake = null;
      w();
    }
  };

  channel.onmessage = (delta) => {
    if (delta.kind === 'content') {
      buffered.push(delta.text);
    } else if (delta.kind === 'done') {
      state.terminal = { done: true };
    } else {
      state.terminal = { error: new Error(delta.message) };
    }
    notify();
  };

  const onAbort = () => {
    if (!state.terminal) {
      state.terminal = { error: new DOMException('Aborted', 'AbortError') };
    }
    notify();
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  // Fire-and-await the invoke in parallel with draining the channel. Any
  // invoke rejection becomes a terminal error; successful return is a no-op
  // because the 'done' delta already signals completion to the iterator.
  const invokePromise = invoke('openai_chat_stream', {
    args: {
      requestId,
      request: {
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        maxTokens: req.maxTokens,
      },
    } satisfies ChatArgs,
    channel,
  }).catch((error: unknown) => {
    if (!state.terminal) {
      state.terminal = { error: classifyOpenAIError(toOpenAIError(error)) };
      notify();
    }
  });

  try {
    while (true) {
      if (buffered.length > 0) {
        yield buffered.shift()!;
        continue;
      }
      const terminal = state.terminal;
      if (terminal) {
        if ('error' in terminal) throw terminal.error;
        return;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    unbind();
    // If we're exiting before the server said "done" (early break, error,
    // abort), make sure the Rust side stops rather than streaming into a
    // channel nobody's reading. `cancel` is idempotent.
    const terminal = state.terminal;
    if (!terminal || 'error' in terminal) {
      void cancel(requestId);
    }
    // `invokePromise` is fire-and-forget: it has its own `.catch` so any
    // late rejection is already swallowed, and awaiting it here would block
    // the caller's throw by however long Rust takes to notice the cancel.
    void invokePromise;
  }
}

// Rust errors arrive as `{ code: 'auth' | 'rate_limit' | ..., status?: number, message: string }`.
// Normalise into a shape classifyOpenAIError understands.
function toOpenAIError(error: unknown): unknown {
  if (!error || typeof error !== 'object') return error;
  const e = error as { code?: string; status?: number; message?: string };
  if (!e.code) return error;
  const codeToType: Record<string, string> = {
    missing_api_key: 'auth',
    auth: 'auth',
    quota: 'quota',
    rate_limit: 'rate_limit',
    not_found: 'not_found',
    network: 'network',
    timeout: 'timeout',
    aborted: 'timeout',
    upstream: 'unknown',
    other: 'unknown',
  };
  return {
    type: codeToType[e.code] ?? 'unknown',
    message: e.message ?? 'Request failed.',
    status: e.status,
    retryable: e.code === 'rate_limit' || e.code === 'network' || e.code === 'timeout',
  };
}

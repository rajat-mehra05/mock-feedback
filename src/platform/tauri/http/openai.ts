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

interface TranscribeArgs {
  requestId: string;
  model: string;
  filename: string;
  contentType: string;
  audio: number[];
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

type TtsEvent =
  | { kind: 'chunk'; bytes: number[] }
  | { kind: 'done' }
  | { kind: 'error'; message: string };

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

  async transcribe(req: TranscribeRequest, signal?: AbortSignal): Promise<string> {
    const requestId = newRequestId();
    const unbind = bindAbort(signal, requestId);
    try {
      const buf = new Uint8Array(await req.audio.arrayBuffer());
      return await invoke<string>('openai_transcribe', {
        args: {
          requestId,
          model: req.model,
          filename: req.filename ?? 'recording.webm',
          contentType: req.audio.type || 'application/octet-stream',
          audio: Array.from(buf),
        } satisfies TranscribeArgs,
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
    const channel = new Channel<TtsEvent>();
    const stream = playMediaSourceStream(signal);
    channel.onmessage = (event) => {
      if (event.kind === 'chunk') {
        stream.push(new Uint8Array(event.bytes));
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

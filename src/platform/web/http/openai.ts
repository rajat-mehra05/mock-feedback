import OpenAI from 'openai';
import type { ChatRequest, OpenAIHttpAdapter, TranscribeRequest, TtsRequest } from '../../types';
import { classifyOpenAIError, createTimeoutSignal } from '@/services/openai/openaiErrors';
import { playAudioArrayBuffer } from '@/services/tts/playback';
import { LLM_TIMEOUT_MS, STT_TIMEOUT_MS, TTS_TIMEOUT_MS } from '@/constants/openai';

type KeyReader = () => Promise<string | null>;

function makeClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: import.meta.env.VITE_OPENAI_BASE_URL,
    dangerouslyAllowBrowser: true,
  });
}

export interface WebOpenAIHttp {
  adapter: OpenAIHttpAdapter;
  /** Test-only: drop the cached client so the next call rebuilds it. */
  clearCache(): void;
}

export function makeWebOpenAIHttp(readKey: KeyReader): WebOpenAIHttp {
  let cachedClient: OpenAI | null = null;
  let cachedKey: string | null = null;

  async function getClient(): Promise<OpenAI> {
    const key = await readKey();
    if (!key) {
      throw new Error('No API key configured. Please add your OpenAI key in Settings.');
    }
    if (cachedClient && cachedKey === key) return cachedClient;
    cachedClient = makeClient(key);
    cachedKey = key;
    return cachedClient;
  }

  async function fetchSpeechImpl(req: TtsRequest, signal?: AbortSignal): Promise<ArrayBuffer> {
    /*
      Network timeout covers only the fetch. Playback-side aborts use the
      caller's signal directly so long responses don't get cut off mid-speech.
    */
    const { signal: networkSignal, cleanup } = createTimeoutSignal(
      req.timeoutMs ?? TTS_TIMEOUT_MS,
      signal,
    );
    try {
      const client = await getClient();
      const response = await client.audio.speech.create(
        {
          model: req.model,
          voice: req.voice,
          input: req.input,
          instructions: req.instructions,
          response_format: req.responseFormat,
        },
        { signal: networkSignal },
      );
      return await response.arrayBuffer();
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/only-throw-error -- classified error
      throw classifyOpenAIError(error);
    } finally {
      cleanup();
    }
  }

  const adapter: OpenAIHttpAdapter = {
    async chat(req: ChatRequest, signal?: AbortSignal): Promise<string> {
      const { signal: merged, cleanup } = createTimeoutSignal(
        req.timeoutMs ?? LLM_TIMEOUT_MS,
        signal,
      );
      try {
        const client = await getClient();
        const response = await client.chat.completions.create(
          {
            model: req.model,
            messages: req.messages,
            temperature: req.temperature,
            max_tokens: req.maxTokens,
          },
          { signal: merged },
        );
        const text = response.choices[0]?.message?.content;
        if (!text) throw new Error('Empty response from chat');
        return text;
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- classified error
        throw classifyOpenAIError(error);
      } finally {
        cleanup();
      }
    },

    chatStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<string> {
      return webChatStream(getClient, req, signal);
    },

    async transcribe(req: TranscribeRequest, signal?: AbortSignal): Promise<string> {
      const { signal: merged, cleanup } = createTimeoutSignal(
        req.timeoutMs ?? STT_TIMEOUT_MS,
        signal,
      );
      try {
        const client = await getClient();
        const file = new File([req.audio], req.filename ?? 'recording.webm', {
          type: req.audio.type,
        });
        const response = await client.audio.transcriptions.create(
          { model: req.model, file },
          { signal: merged },
        );
        return response.text;
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- classified error
        throw classifyOpenAIError(error);
      } finally {
        cleanup();
      }
    },

    fetchSpeech: fetchSpeechImpl,

    async speak(req: TtsRequest, signal?: AbortSignal): Promise<void> {
      const arrayBuffer = await fetchSpeechImpl(req, signal);
      await playAudioArrayBuffer(arrayBuffer, signal);
    },
  };

  return {
    adapter,
    clearCache() {
      cachedClient = null;
      cachedKey = null;
    },
  };
}

async function* webChatStream(
  getClient: () => Promise<OpenAI>,
  req: ChatRequest,
  signal?: AbortSignal,
): AsyncIterable<string> {
  // Timeout covers the network establishment; once tokens start flowing, the
  // caller's own signal is responsible for cancellation.
  const { signal: merged, cleanup } = createTimeoutSignal(req.timeoutMs ?? LLM_TIMEOUT_MS, signal);
  try {
    const client = await getClient();
    const stream = await client.chat.completions.create(
      {
        model: req.model,
        messages: req.messages,
        temperature: req.temperature,
        max_tokens: req.maxTokens,
        stream: true,
      },
      { signal: merged },
    );
    // Stream is established — clear the network timeout so a slow but healthy
    // token stream isn't killed when it exceeds LLM_TIMEOUT_MS. The caller's
    // own `signal` still reaches the stream via the merged abort signal.
    // `cleanup` (clearTimeout) is idempotent so the finally call is a no-op.
    cleanup();
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error -- classified error
    throw classifyOpenAIError(error);
  } finally {
    cleanup();
  }
}

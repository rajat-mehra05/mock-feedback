// Platform surface contracts. Web and Tauri adapters implement these.
import type { ConfidenceLevel } from '@/services/types';

export type PlatformTarget = 'web' | 'tauri';
export interface SecretsAdapter {
  set(key: string, value: string): Promise<void>;
  has(key: string): Promise<boolean>;
  clear(key: string): Promise<void>;
}

export interface Question {
  id: string;
  questionText: string;
  userTranscript: string;
  rating: number;
  feedback: string;
  confidence?: ConfidenceLevel;
  modelAnswer: string;
}

export interface Session {
  id: string;
  topic: string;
  createdAt: Date;
  duration: number;
  questionCount: number;
  averageScore: number;
  questions: Question[];
  summary?: string;
}

export interface SessionsAdapter {
  create(session: Session): Promise<void>;
  get(id: string): Promise<Session | undefined>;
  getAll(): Promise<Session[]>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export interface PreferencesAdapter {
  saveCandidateName(name: string): Promise<void>;
  getCandidateName(): Promise<string | null>;
  getOrCreateDeviceId(): Promise<string>;
}

export interface StorageAdapter {
  secrets: SecretsAdapter;
  sessions: SessionsAdapter;
  preferences: PreferencesAdapter;
}

export interface AnalyticsAdapter {
  track(name: string, props?: Record<string, string | number | boolean>): Promise<void>;
}

// Durable diagnostics. Tauri writes to `app_log_dir()` via `tauri-plugin-log`;
// web writes to the browser console.
//
// Callers MUST NOT pass secrets or PII: no raw `Response`/`Request`, no
// headers, no API keys, session tokens, or user input (candidate name,
// transcript, answer text). Third-party SDK error messages sometimes echo
// the request payload — prefer `error.name + error.message` over the full
// `Error` object when the source isn't under our control.
export interface LoggerAdapter {
  info(message: string, ...extras: unknown[]): void;
  warn(message: string, ...extras: unknown[]): void;
  error(message: string, ...extras: unknown[]): void;
}

// Streaming chat delta emitted by platform.http.openai.chat.
export interface ChatDelta {
  content?: string;
  done?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  /** Network timeout in ms. Covers only the HTTP request, not any playback. */
  timeoutMs?: number;
}

export interface TranscribeRequest {
  model: string;
  audio: Blob;
  filename?: string;
  timeoutMs?: number;
}

export type TtsResponseFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

export interface TtsRequest {
  model: string;
  voice: string;
  input: string;
  instructions?: string;
  responseFormat?: TtsResponseFormat;
  /** Network timeout in ms. Playback is governed by the caller's abort signal. */
  timeoutMs?: number;
}

/** Metadata needed to commit a streamed transcription. */
export interface TranscribeCommitRequest {
  requestId: string;
  model: string;
  filename: string;
  contentType: string;
  // Set when buffered chunks are raw 16-bit mono PCM at this rate; the
  // backend prepends a WAV header before uploading. Omit for self-contained
  // container formats.
  sampleRate?: number;
}

/** Optional capability: push audio bytes to the backend during recording so
 *  the final upload doesn't have to ship the entire blob across IPC at
 *  mic-stop time. Implemented by the Tauri adapter; the web path has no
 *  intermediate backend to pre-buffer into and leaves these undefined. */
export interface TranscribeStreamingOps {
  // `chunk` is raw 16-bit little-endian mono PCM at CAPTURE_SAMPLE_RATE
  // (16kHz) from `public/audio/downsample-worklet.js`. Rust concatenates
  // chunks in arrival order and prepends a WAV header on commit.
  pushChunk(requestId: string, chunk: Uint8Array): Promise<void>;
  /** Called on mic-stop. Returns the transcript. */
  commit(req: TranscribeCommitRequest, signal?: AbortSignal): Promise<string>;
  /** Called when a recording is abandoned without a commit. Idempotent. */
  discard(requestId: string): Promise<void>;
}

export interface OpenAIHttpAdapter {
  /** Non-streaming chat. Returns the full text. Used for feedback generation. */
  chat(req: ChatRequest, signal?: AbortSignal): Promise<string>;
  /** Streaming chat. Yields text chunks as they arrive. Used for the live
   *  interview turn so TTS can start on sentence 1 before chat completes. */
  chatStream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<string>;
  /** Transcribes an audio blob. */
  transcribe(req: TranscribeRequest, signal?: AbortSignal): Promise<string>;
  // Optional streamed-upload path. `undefined` on web.
  transcribeStreaming?: TranscribeStreamingOps;
  /** Requests TTS audio. Plays it to completion or rejects on abort. */
  speak(req: TtsRequest, signal?: AbortSignal): Promise<void>;
}

export interface HttpAdapter {
  openai: OpenAIHttpAdapter;
}

// Pluggable update check. Tauri hits GitHub Releases; web returns null
// since there's no installed artifact to update.
export interface UpdateInfo {
  latestVersion: string;
  htmlUrl: string;
}

export interface UpdaterAdapter {
  /** Resolves with an `UpdateInfo` when a newer release exists, or `null`
   *  when the current version is up to date. Rejects when the check itself
   *  fails (network, rate limit, parse error) so callers can distinguish
   *  "up to date" from "can't check": the launch toast catches rejections
   *  silently; the Settings row shows an error state. The web adapter
   *  always resolves to `null` — no installed artifact to update. */
  checkForUpdate(): Promise<UpdateInfo | null>;
  /** Opens the release page in the user's default browser. Adapters
   *  validate the URL and contain platform failures — callers do not
   *  need to try/catch. */
  openReleasePage(url: string): Promise<void>;
}

export interface Platform {
  target: PlatformTarget;
  storage: StorageAdapter;
  analytics: AnalyticsAdapter;
  http: HttpAdapter;
  logger: LoggerAdapter;
  updater: UpdaterAdapter;
}

/** Canonical identifier for the OpenAI API key in the secrets adapter. */
export const SECRET_OPENAI_API_KEY = 'openai_api_key';

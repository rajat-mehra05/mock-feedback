/**
 * Platform surface contracts. Web and Tauri adapters implement these.
 * Surfaces are fleshed out across phases:
 *   - storage: Phase 5 (secrets, sessions, preferences)
 *   - analytics: Phase 6
 *   - http (OpenAI): Phase 7
 *   - updater: Phase 10
 */

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

export interface OpenAIHttpAdapter {
  /** Non-streaming chat. Returns the full text. */
  chat(req: ChatRequest, signal?: AbortSignal): Promise<string>;
  /** Transcribes an audio blob. */
  transcribe(req: TranscribeRequest, signal?: AbortSignal): Promise<string>;
  /** Requests TTS audio. Plays it to completion or rejects on abort. */
  speak(req: TtsRequest, signal?: AbortSignal): Promise<void>;
}

export interface HttpAdapter {
  openai: OpenAIHttpAdapter;
}

export interface Platform {
  target: PlatformTarget;
  storage: StorageAdapter;
  analytics: AnalyticsAdapter;
  http: HttpAdapter;
}

/** Canonical identifier for the OpenAI API key in the secrets adapter. */
export const SECRET_OPENAI_API_KEY = 'openai_api_key';

// Model identifiers
export const STT_MODEL = 'gpt-4o-mini-transcribe';
export const LLM_MODEL = 'gpt-4o-mini';
export const TTS_MODEL = 'gpt-4o-mini-tts';
export const TTS_VOICE = 'alloy' as const;

// Timeouts (milliseconds)
export const STT_TIMEOUT_MS = 60_000;
export const LLM_TIMEOUT_MS = 20_000;
export const TTS_TIMEOUT_MS = 30_000;

// LLM generation parameters
export const LLM_TEMPERATURE = 0.8;
export const LLM_MAX_TOKENS = 300;

// TTS instructions for voice tone
export const TTS_INSTRUCTIONS =
  'Speak in a calm, friendly tone like a staff engineer conducting a technical ' +
  'interview. Use natural pacing with brief pauses between sentences. Do not rush.';

// TTS response format
export const TTS_RESPONSE_FORMAT = 'mp3' as const;

// Closing message spoken after the last answer, before feedback generation
export const INTERVIEW_CLOSING_MESSAGE =
  'Thank you for taking part in this interview. That was the last question. ' +
  'Your detailed feedback will be ready in just a moment.';

// Audio recording MIME types by browser capability
export const AUDIO_MIME_TYPES = {
  WEBM: 'audio/webm;codecs=opus',
  MP4: 'audio/mp4',
} as const;

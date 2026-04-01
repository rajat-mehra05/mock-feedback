// Model identifiers
export const STT_MODEL = 'gpt-4o-mini-transcribe';
export const LLM_MODEL = 'gpt-4o-mini';
export const TTS_MODEL = 'gpt-4o-mini-tts';
export const TTS_VOICE = 'alloy' as const;

// Timeouts (milliseconds)
export const STT_TIMEOUT_MS = 30_000;
export const LLM_TIMEOUT_MS = 20_000;
export const TTS_TIMEOUT_MS = 15_000;

// STT prompt hint for technical term accuracy
export const STT_PROMPT_HINT =
  'React, useState, useEffect, Next.js, Node.js, TypeScript, async/await, ' +
  'JavaScript, closure, prototype, event loop, middleware, REST, GraphQL, ' +
  'webpack, Vite, SSR, SSG, ISR, hydration, reconciliation, virtual DOM';

// LLM system prompt — {topic} is replaced at call time
export const INTERVIEW_SYSTEM_PROMPT =
  'You are a senior software developer with 10+ years of experience conducting a ' +
  '{topic} technical interview.\n\n' +
  'Rules:\n' +
  '- Start with a warm intro question like "Tell me about your experience with {topic}" ' +
  'before moving to technical questions.\n' +
  '- Ask one clear, focused question at a time (1-3 sentences).\n' +
  "- Build on the candidate's previous answers when appropriate.\n" +
  '- If the candidate says "I don\'t know", "pass", "skip", or gives a very short non-answer, ' +
  'acknowledge it briefly ("No problem, let\'s move on") and ask the next question on a ' +
  'different sub-topic.\n' +
  '- If the candidate asks you to wait or says they need a moment, respond with ' +
  '"Take your time, I\'ll wait" and ask the same question again.\n' +
  '- Do not provide the answer or hints. Do not number the questions.';

// LLM generation parameters
export const LLM_TEMPERATURE = 0.8;
export const LLM_MAX_TOKENS = 300;

// TTS instructions for voice tone
export const TTS_INSTRUCTIONS =
  'Speak in a calm, professional tone like a senior engineer conducting a technical ' +
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

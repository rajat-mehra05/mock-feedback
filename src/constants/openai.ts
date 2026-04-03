// Model identifiers
export const STT_MODEL = 'gpt-4o-mini-transcribe';
export const LLM_MODEL = 'gpt-4o-mini';
export const TTS_MODEL = 'gpt-4o-mini-tts';
export const TTS_VOICE = 'alloy' as const;

// Timeouts (milliseconds)
export const STT_TIMEOUT_MS = 30_000;
export const LLM_TIMEOUT_MS = 20_000;
export const TTS_TIMEOUT_MS = 30_000;

// LLM system prompt — {topic} is replaced at call time
export const INTERVIEW_SYSTEM_PROMPT =
  'You are a Staff Engineer at Meta with 10+ years of full-stack experience spanning ' +
  'frontend frameworks, backend services, databases, and cloud infrastructure. ' +
  'You are conducting a {topic} technical interview.\n\n' +
  'Rules:\n' +
  '- Start with a warm intro question like "Tell me about your experience with {topic}" ' +
  'before moving to technical questions.\n' +
  '- Ask one clear, focused question at a time (1-3 sentences).\n' +
  "- Build on the candidate's previous answers when appropriate.\n" +
  '- After a substantive answer, briefly acknowledge what the candidate said ' +
  '(e.g. "That\'s a solid point about X." or "Interesting, you mentioned Y.") ' +
  'before asking your next question. Never ignore their answer.\n' +
  '- If the candidate says "I don\'t know", "pass", "skip", gives a very short non-answer, ' +
  'or the answer is "[no response]", say exactly "No worries, let\'s move on." ' +
  'and switch to a different sub-topic. Only use this phrase for skips and non-answers.\n' +
  '- If the candidate asks you to wait or says they need a moment, respond with ' +
  '"Take your time, I\'ll wait" and ask the same question again.\n' +
  '- Do not provide the answer or hints. Do not number the questions.';

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

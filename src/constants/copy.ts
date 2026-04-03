export const APP_NAME = 'Mock Feedback';

export const EMPTY_SESSIONS_MESSAGE = 'Your past interview sessions will appear here';
export const API_KEY_DESCRIPTION =
  'This app requires your own OpenAI API key. Your key stays on your device and is only sent to OpenAI.';
export const OPENAI_API_KEYS_URL = 'https://platform.openai.com/api-keys';

import { SILENCE_TIMEOUT_SECONDS } from '@/constants/session';

export const RECORDING_RULES = `Max answer length: 4 minutes · Auto-proceeds after ${SILENCE_TIMEOUT_SECONDS} seconds of silence`;

export const UNSUPPORTED_BROWSER_MESSAGE =
  "Your browser doesn't support audio recording. Please use a recent version of Chrome, Firefox, or Safari.";
export const NO_MIC_MESSAGE = 'No microphone detected. Please connect a microphone and try again.';
export const MIC_PERMISSION_MESSAGE =
  'Microphone access is required for the interview. Please allow microphone access in your browser settings and reload the page.';

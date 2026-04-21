export const APP_NAME = 'VoiceRound';

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

// Home page
export const HOME_BADGE = 'AI-Powered Mock Interviews';
export const HOME_HERO_HEADING_LINE1 = 'Nail your next';
export const HOME_HERO_HEADING_LINE2 = 'tech interview';
export const HOME_HERO_BODY =
  'Practice real interviews out loud with an AI that listens, evaluates and improves your answers.';
export const HOME_HERO_TAGLINE = 'No fluff. Just honest feedback. Real improvement.';
export const HOME_START_LABEL = 'Start new interview session';
export const HOME_CTA_HINT = 'Ready when you are.';
export const HOME_FOOTER_OPEN_SOURCE = 'Fully Open source ❤️';
export const GITHUB_REPO_URL = 'https://github.com/rajat-mehra05/voice-round';
export const GITHUB_ISSUES_URL = 'https://github.com/rajat-mehra05/voice-round/issues';

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
export const GITHUB_RELEASES_URL = 'https://github.com/rajat-mehra05/voice-round/releases/latest';
export const HOME_DESKTOP_CTA_HINT = 'Prefer native?';
export const HOME_DESKTOP_CTA_LABEL = 'Get the desktop app';

// Install section (web-only) — desktop users already have the app.
export const INSTALL_HEADING = 'Installation';
export const INSTALL_SUBHEADING =
  'Native desktop app for macOS and Windows. Unsigned, so the OS will warn once.';

export const INSTALL_MACOS_STEPS: string[] = [
  'Download the .dmg below and open it.',
  'Drag VoiceRound into Applications.',
  'First launch shows "developer cannot be verified". Click Cancel.',
  'Right-click the app in Applications → Open → Open again. Trusted from then on.',
  'Grant microphone access and enter your OpenAI API key on first launch.',
];

export const INSTALL_MACOS_FALLBACK =
  'If right-click → Open does not offer the trust option, run this once in Terminal:';
export const INSTALL_MACOS_FALLBACK_COMMAND =
  'xattr -d com.apple.quarantine /Applications/VoiceRound.app';

export const INSTALL_MACOS_NOTE =
  'macOS shows an "unidentified developer" warning because the build is unsigned. Expected for open-source apps without a paid Apple Developer certificate.';

export const INSTALL_WINDOWS_STEPS: string[] = [
  'Download the .exe below and run it.',
  'SmartScreen shows "Windows protected your PC". Click More info → Run anyway.',
  'The installer fetches the Microsoft WebView2 runtime automatically if needed.',
  'Grant microphone access and enter your OpenAI API key on first launch.',
];

export const INSTALL_WINDOWS_NOTE =
  'Windows SmartScreen warns on unsigned apps. Clicking "More info" reveals the "Run anyway" button.';

export const INSTALL_DOWNLOAD_HEADING = 'Download';
export const INSTALL_DOWNLOAD_PRIMARY_MAC = 'Download for macOS';
export const INSTALL_DOWNLOAD_PRIMARY_WINDOWS = 'Download for Windows';
export const INSTALL_DOWNLOAD_ALSO_FOR = 'Also available for';

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_OPENAI_BASE_URL: string;
  readonly VITE_MAX_RECORDING_SECONDS: string;
  readonly VITE_SILENCE_TIMEOUT_SECONDS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

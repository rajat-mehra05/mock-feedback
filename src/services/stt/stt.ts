import { platform } from '@/platform';
import { STT_MODEL } from '@/constants/openai';
import { mark } from '@/lib/perf';

/**
 * Transcribes an audio blob using OpenAI's STT model.
 * Returns the transcript text. The adapter handles network timeouts and
 * keychain-backed authentication on Tauri.
 */
export async function transcribeAudio(blob: Blob, signal?: AbortSignal): Promise<string> {
  mark('transcribe_start');
  try {
    return await platform.http.openai.transcribe(
      { model: STT_MODEL, audio: blob, filename: filenameFor(blob) },
      signal,
    );
  } finally {
    mark('transcribe_end');
  }
}

// OpenAI's transcription endpoint uses the filename extension to infer the
// container format. Safari / WKWebView (Tauri on macOS) produces `audio/mp4`
// because webm/opus isn't supported there, so a hardcoded `.webm` name leads
// to `invalid_value` even though the bytes are fine.
function filenameFor(blob: Blob): string {
  const type = blob.type.split(';')[0];
  const ext = EXT_BY_MIME[type] ?? 'webm';
  return `recording.${ext}`;
}

const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
};

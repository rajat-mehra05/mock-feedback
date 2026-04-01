import OpenAI from 'openai';
import { getApiKey } from '@/db/apiKey/apiKey';

let cachedClient: OpenAI | null = null;
let cachedKey: string | null = null;

/**
 * Returns a cached OpenAI client, creating a new one if the API key changed.
 * Reads the key from IndexedDB — throws if no key is configured.
 */
export async function getOpenAIClient(): Promise<OpenAI> {
  const key = await getApiKey();
  if (!key) {
    throw new Error('No API key configured. Please add your OpenAI key in Settings.');
  }
  if (cachedClient && cachedKey === key) {
    return cachedClient;
  }
  cachedClient = new OpenAI({
    apiKey: key,
    baseURL: import.meta.env.VITE_OPENAI_BASE_URL,
    dangerouslyAllowBrowser: true,
  });
  cachedKey = key;
  return cachedClient;
}

/** Resets the cached client (call when the user removes their API key). */
export function clearOpenAIClient(): void {
  cachedClient = null;
  cachedKey = null;
}

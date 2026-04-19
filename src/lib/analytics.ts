import { track } from '@vercel/analytics';
import { getOrCreateDeviceId } from '@/db/preferences/preferences';

let cachedDeviceId: string | null = null;

async function ensureDeviceId(): Promise<string> {
  if (!cachedDeviceId) {
    cachedDeviceId = await getOrCreateDeviceId();
  }
  return cachedDeviceId;
}

export async function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>,
): Promise<void> {
  try {
    const deviceId = await ensureDeviceId();
    track(name, { ...props, deviceId });
  } catch {
    // Analytics should never break the app
  }
}

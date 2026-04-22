import { platform } from '@/platform';

export function trackEvent(
  name: string,
  props?: Record<string, string | number | boolean>,
): Promise<void> {
  return platform.analytics.track(name, props);
}

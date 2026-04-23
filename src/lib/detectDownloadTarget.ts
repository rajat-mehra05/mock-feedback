export type DownloadTarget = 'mac' | 'windows';

// Linux and unknown UAs fall back to mac; the "Also available for X"
// switch is the one-click manual override.
export function detectDownloadTarget(userAgent: string): DownloadTarget {
  if (/Windows/i.test(userAgent)) return 'windows';
  return 'mac';
}

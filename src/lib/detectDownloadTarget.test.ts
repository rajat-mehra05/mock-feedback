import { expect, test } from 'vitest';
import { detectDownloadTarget } from './detectDownloadTarget';

test('detectDownloadTarget picks windows only when the UA explicitly includes that token', () => {
  expect(
    detectDownloadTarget(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    ),
  ).toBe('windows');
  expect(
    detectDownloadTarget(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    ),
  ).toBe('mac');
  // Linux / unknown UAs fall back to mac; the "Also available for X" link is the escape hatch.
  expect(detectDownloadTarget('Mozilla/5.0 (X11; Linux x86_64)')).toBe('mac');
  expect(detectDownloadTarget('')).toBe('mac');
});

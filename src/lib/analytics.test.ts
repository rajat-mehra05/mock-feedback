import { expect, test, vi } from 'vitest';

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}));

import { track } from '@vercel/analytics';
import { trackEvent } from './analytics';

test('trackEvent calls track with event name, custom properties, and an auto-generated deviceId', async () => {
  await trackEvent('session_started', { topic: 'React', questionCount: 5 });

  expect(track).toHaveBeenCalledOnce();
  const [name, props] = vi.mocked(track).mock.calls[0];
  expect(name).toBe('session_started');
  expect(props).toMatchObject({ topic: 'React', questionCount: 5 });
  expect((props as Record<string, unknown>).deviceId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );

  // Second call reuses the same cached deviceId
  await trackEvent('feedback_viewed');
  const secondProps = vi.mocked(track).mock.calls[1][1] as Record<string, unknown>;
  expect(secondProps.deviceId).toBe((props as Record<string, unknown>).deviceId);
});

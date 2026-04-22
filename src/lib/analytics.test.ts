import { expect, test, vi } from 'vitest';

test('trackEvent calls the underlying SDK with event name, custom props, and an auto-generated deviceId', async ({
  onTestFinished,
}) => {
  const trackMock = vi.fn();
  vi.doMock('@vercel/analytics', () => ({ track: trackMock }));
  vi.resetModules();
  onTestFinished(() => {
    vi.doUnmock('@vercel/analytics');
    vi.resetModules();
  });

  const { trackEvent } = await import('./analytics');

  await trackEvent('session_started', { topic: 'React', questionCount: 5 });

  expect(trackMock).toHaveBeenCalledOnce();
  const [name, props] = trackMock.mock.calls[0] as [string, Record<string, unknown>];
  expect(name).toBe('session_started');
  expect(props).toMatchObject({ topic: 'React', questionCount: 5 });
  expect(props.deviceId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  await trackEvent('feedback_viewed');
  const secondCall = trackMock.mock.calls[1] as [string, Record<string, unknown>];
  expect(secondCall[1].deviceId).toBe(props.deviceId);
});

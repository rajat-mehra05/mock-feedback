import { expect, test, vi } from 'vitest';

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));

test('web platform delegates analytics through to the underlying SDK wrapper', async () => {
  const { platform } = await import('./index');
  const { track } = await import('@vercel/analytics');

  expect(platform.target).toBe('web');

  await platform.analytics.track('platform_test_event', { topic: 'rust' });

  expect(track).toHaveBeenCalledOnce();
  const [name, props] = vi.mocked(track).mock.calls[0];
  expect(name).toBe('platform_test_event');
  expect(props).toMatchObject({ topic: 'rust' });
});

test('tauri platform stubs secrets until Phase 7 and silences analytics', async ({
  onTestFinished,
}) => {
  vi.stubEnv('VITE_TARGET', 'tauri');
  vi.resetModules();
  onTestFinished(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const { platform } = await import('./index');

  expect(platform.target).toBe('tauri');
  await expect(platform.storage.secrets.has('openai_api_key')).rejects.toThrow(/not wired yet/i);
  await expect(platform.analytics.track('noop_event')).resolves.toBeUndefined();
});

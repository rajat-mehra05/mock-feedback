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

test('tauri platform routes secrets through IPC commands and silences analytics', async ({
  onTestFinished,
}) => {
  vi.stubEnv('VITE_TARGET', 'tauri');
  const invokeMock = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>();
  vi.doMock('@tauri-apps/api/core', () => ({ invoke: invokeMock }));
  vi.resetModules();
  onTestFinished(() => {
    vi.unstubAllEnvs();
    vi.doUnmock('@tauri-apps/api/core');
    vi.resetModules();
  });

  const { platform } = await import('./index');

  expect(platform.target).toBe('tauri');

  invokeMock.mockResolvedValueOnce(undefined);
  await platform.storage.secrets.set('openai_api_key', 'sk-test');
  expect(invokeMock).toHaveBeenLastCalledWith('secret_set', {
    key: 'openai_api_key',
    value: 'sk-test',
  });

  invokeMock.mockResolvedValueOnce(true);
  await expect(platform.storage.secrets.has('openai_api_key')).resolves.toBe(true);
  expect(invokeMock).toHaveBeenLastCalledWith('secret_has', { key: 'openai_api_key' });

  invokeMock.mockResolvedValueOnce(undefined);
  await platform.storage.secrets.clear('openai_api_key');
  expect(invokeMock).toHaveBeenLastCalledWith('secret_clear', { key: 'openai_api_key' });

  const invokeCallsBefore = invokeMock.mock.calls.length;
  await expect(platform.storage.secrets.set('other_key', 'x')).rejects.toThrow(
    /unknown secret key/i,
  );
  expect(invokeMock.mock.calls.length).toBe(invokeCallsBefore);

  await expect(platform.analytics.track('noop_event')).resolves.toBeUndefined();
});

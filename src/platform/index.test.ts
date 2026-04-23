import { expect, test, vi } from 'vitest';

test('web platform delegates analytics through to the underlying SDK wrapper', async ({
  onTestFinished,
}) => {
  const trackMock = vi.fn();
  vi.doMock('@vercel/analytics', () => ({ track: trackMock }));
  vi.resetModules();
  onTestFinished(() => {
    vi.doUnmock('@vercel/analytics');
    vi.resetModules();
  });

  const { platform } = await import('./index');

  expect(platform.target).toBe('web');

  await platform.analytics.track('platform_test_event', { topic: 'rust' });

  expect(trackMock).toHaveBeenCalledOnce();
  const [name, props] = trackMock.mock.calls[0] as [string, Record<string, unknown>];
  expect(name).toBe('platform_test_event');
  expect(props).toMatchObject({ topic: 'rust' });
});

test('tauri platform routes secrets through IPC commands and silences analytics', async ({
  onTestFinished,
}) => {
  vi.stubEnv('VITE_TARGET', 'tauri');
  const invokeMock = vi.fn<(cmd: string, args?: unknown) => Promise<unknown>>();
  vi.doMock('@tauri-apps/api/core', () => ({
    invoke: invokeMock,
    Channel: class {},
  }));
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

test('web secrets.set calls navigator.storage.persist after a successful save', async ({
  onTestFinished,
}) => {
  const persistMock = vi.fn().mockResolvedValue(true);
  vi.stubGlobal('navigator', {
    ...navigator,
    storage: { persist: persistMock, estimate: vi.fn().mockResolvedValue({}) },
  });
  vi.resetModules();
  const { platform } = await import('./index');
  // Cleanup runs even if the assertion below throws.
  onTestFinished(async () => {
    await platform.storage.secrets.clear('openai_api_key').catch(() => undefined);
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  await platform.storage.secrets.set('openai_api_key', 'sk-test');
  expect(persistMock).toHaveBeenCalledOnce();
});

test('web secrets.set tolerates a false return from persist (Safari path)', async ({
  onTestFinished,
}) => {
  const persistMock = vi.fn().mockResolvedValue(false);
  vi.stubGlobal('navigator', {
    ...navigator,
    storage: { persist: persistMock, estimate: vi.fn().mockResolvedValue({}) },
  });
  vi.resetModules();
  const { platform } = await import('./index');
  onTestFinished(async () => {
    await platform.storage.secrets.clear('openai_api_key').catch(() => undefined);
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  await expect(
    platform.storage.secrets.set('openai_api_key', 'sk-safari'),
  ).resolves.toBeUndefined();
  expect(persistMock).toHaveBeenCalledOnce();
});

test('web secrets.set tolerates a thrown persist (paranoid browser path)', async ({
  onTestFinished,
}) => {
  const persistMock = vi.fn().mockRejectedValue(new Error('storage policy blocks persist'));
  vi.stubGlobal('navigator', {
    ...navigator,
    storage: { persist: persistMock, estimate: vi.fn().mockResolvedValue({}) },
  });
  vi.resetModules();
  const { platform } = await import('./index');
  onTestFinished(async () => {
    await platform.storage.secrets.clear('openai_api_key').catch(() => undefined);
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  await expect(platform.storage.secrets.set('openai_api_key', 'sk-test')).resolves.toBeUndefined();
  expect(persistMock).toHaveBeenCalledOnce();
});

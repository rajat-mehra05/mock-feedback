import { expect, test, vi } from 'vitest';
import { deleteApiKey, getApiKey, saveApiKey } from '../storage/apiKeyIndexedDb';

const MARKER_KEY = 'secrets_migrated_v1';

async function freshEnvironment(): Promise<void> {
  await deleteApiKey();
  localStorage.removeItem(MARKER_KEY);
  vi.resetModules();
}

// A user upgrading from a pre-Phase-7 build has their OpenAI key in IndexedDB.
// After the upgrade, the key must move to the OS keychain, IndexedDB must be
// cleared, and a subsequent launch must not re-run the migration.
test('user upgrading from a pre-keychain build: key moves to keychain once, then migration is a no-op on every later launch', async ({
  onTestFinished,
}) => {
  await freshEnvironment();
  await saveApiKey('sk-legacy-key');

  const invoke = vi.fn((cmd: string) =>
    cmd === 'secret_has' ? Promise.resolve(true) : Promise.resolve(undefined),
  );
  vi.doMock('@tauri-apps/api/core', () => ({ invoke, Channel: class {} }));
  onTestFinished(() => {
    vi.doUnmock('@tauri-apps/api/core');
    vi.resetModules();
    localStorage.removeItem(MARKER_KEY);
  });

  const { migrateIndexedDbKeyToKeychain } = await import('./migrateApiKey');

  // First launch after upgrade.
  await migrateIndexedDbKeyToKeychain();
  expect(invoke).toHaveBeenCalledWith('secret_set', {
    key: 'openai_api_key',
    value: 'sk-legacy-key',
  });
  expect(invoke).toHaveBeenCalledWith('secret_has', { key: 'openai_api_key' });
  expect(await getApiKey()).toBeNull();

  // Every launch after that: migration short-circuits.
  invoke.mockClear();
  await migrateIndexedDbKeyToKeychain();
  expect(invoke).not.toHaveBeenCalled();
});

// The plan calls this "the worst possible bug for a BYOK app." If the keychain
// write silently fails verification, we must keep the IndexedDB copy so the
// user doesn't lose their API key.
test('keychain verification failure leaves the IndexedDB key intact so the user never loses their BYOK key', async ({
  onTestFinished,
}) => {
  await freshEnvironment();
  await saveApiKey('sk-legacy-key');

  const invoke = vi.fn((cmd: string) =>
    cmd === 'secret_has' ? Promise.resolve(false) : Promise.resolve(undefined),
  );
  vi.doMock('@tauri-apps/api/core', () => ({ invoke, Channel: class {} }));
  onTestFinished(() => {
    vi.doUnmock('@tauri-apps/api/core');
    vi.resetModules();
    localStorage.removeItem(MARKER_KEY);
  });

  const { migrateIndexedDbKeyToKeychain } = await import('./migrateApiKey');
  await migrateIndexedDbKeyToKeychain();

  expect(await getApiKey()).toBe('sk-legacy-key');
  expect(localStorage.getItem(MARKER_KEY)).toBeNull();
});

// Fresh installs of the Phase-7 build have no IndexedDB key to migrate. The
// migration should mark itself done without touching the keychain.
test('fresh install with no pre-existing IndexedDB key marks migration done without touching the keychain', async ({
  onTestFinished,
}) => {
  await freshEnvironment();

  const invoke = vi.fn();
  vi.doMock('@tauri-apps/api/core', () => ({ invoke, Channel: class {} }));
  onTestFinished(() => {
    vi.doUnmock('@tauri-apps/api/core');
    vi.resetModules();
    localStorage.removeItem(MARKER_KEY);
  });

  const { migrateIndexedDbKeyToKeychain } = await import('./migrateApiKey');
  await migrateIndexedDbKeyToKeychain();

  expect(invoke).not.toHaveBeenCalled();
  expect(localStorage.getItem(MARKER_KEY)).toBe('1');
});

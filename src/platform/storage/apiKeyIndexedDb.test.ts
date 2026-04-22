import { expect, test } from 'vitest';
import { saveApiKey, getApiKey, deleteApiKey } from './apiKeyIndexedDb';

test('save, retrieve, and delete API key lifecycle', async () => {
  await deleteApiKey();

  expect(await getApiKey()).toBeNull();

  await saveApiKey('sk-test-key-123');
  expect(await getApiKey()).toBe('sk-test-key-123');

  await saveApiKey('sk-updated-key-456');
  expect(await getApiKey()).toBe('sk-updated-key-456');

  await deleteApiKey();
  expect(await getApiKey()).toBeNull();
});

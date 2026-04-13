import { expect, test } from 'vitest';
import { saveApiKey, getApiKey, deleteApiKey } from './apiKey';

test('save, retrieve, and delete API key lifecycle', async () => {
  await deleteApiKey();

  // Initially no key
  expect(await getApiKey()).toBeNull();

  // Save a key
  await saveApiKey('sk-test-key-123');
  expect(await getApiKey()).toBe('sk-test-key-123');

  // Update the key
  await saveApiKey('sk-updated-key-456');
  expect(await getApiKey()).toBe('sk-updated-key-456');

  // Delete the key
  await deleteApiKey();
  expect(await getApiKey()).toBeNull();
});

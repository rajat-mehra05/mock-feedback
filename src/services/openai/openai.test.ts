import { expect, test } from 'vitest';
import { saveApiKey, deleteApiKey } from '@/db/apiKey/apiKey';
import { getOpenAIClient, clearOpenAIClient } from '@/services/openai/openai';

test('getOpenAIClient throws without a key, returns cached client for same key, and refreshes on key change', async () => {
  await deleteApiKey();
  clearOpenAIClient();

  // Throws when no key is configured
  await expect(getOpenAIClient()).rejects.toThrow(/no api key configured/i);

  // Returns a client after saving a key
  await saveApiKey('sk-test-key-1');
  const client1 = await getOpenAIClient();
  expect(client1).toBeDefined();

  // Returns the same cached instance for the same key
  const client2 = await getOpenAIClient();
  expect(client2).toBe(client1);

  // Returns a new client after key changes
  await saveApiKey('sk-test-key-2');
  const client3 = await getOpenAIClient();
  expect(client3).not.toBe(client1);

  // clearOpenAIClient resets the cache — next call with same key creates fresh client
  clearOpenAIClient();
  const client4 = await getOpenAIClient();
  expect(client4).not.toBe(client3);
});

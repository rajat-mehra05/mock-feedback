import { expect, test } from 'vitest';
import { saveCandidateName, getCandidateName, getOrCreateDeviceId } from './preferences';

test('candidate name save, retrieve, and overwrite lifecycle', async () => {
  expect(await getCandidateName()).toBeNull();

  await saveCandidateName('Alice');
  expect(await getCandidateName()).toBe('Alice');

  await saveCandidateName('Bob');
  expect(await getCandidateName()).toBe('Bob');
});

test('getOrCreateDeviceId generates a UUID on first call and returns the same value on subsequent calls', async () => {
  const first = await getOrCreateDeviceId();
  expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

  const second = await getOrCreateDeviceId();
  expect(second).toBe(first);
});

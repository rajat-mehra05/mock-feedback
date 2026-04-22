import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { platform, SECRET_OPENAI_API_KEY } from '@/platform';
import { _resetWebPlatformForTests } from '@/platform/web';
import { server } from '@/test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  // Run every cleanup step even if one throws — otherwise a single failing
  // test can leave secrets or caches polluted for the next test and hide the
  // real failure behind cascading symptoms.
  const errors: unknown[] = [];
  try {
    await platform.storage.sessions.deleteAll();
  } catch (e) {
    errors.push(e);
  }
  try {
    await platform.storage.secrets.clear(SECRET_OPENAI_API_KEY);
  } catch (e) {
    errors.push(e);
  }
  try {
    _resetWebPlatformForTests();
  } catch (e) {
    errors.push(e);
  }
  if (errors.length > 0) throw errors[0];
});

afterAll(() => server.close());

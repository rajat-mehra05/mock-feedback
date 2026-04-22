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
  await platform.storage.sessions.deleteAll();
  await platform.storage.secrets.clear(SECRET_OPENAI_API_KEY);
  _resetWebPlatformForTests();
});

afterAll(() => server.close());

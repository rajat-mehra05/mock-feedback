import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { db } from '@/db/sessions/sessions';
import { deleteApiKey } from '@/db/apiKey/apiKey';
import { server } from '@/test/msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  await db.sessions.clear();
  await deleteApiKey();
});

afterAll(() => server.close());

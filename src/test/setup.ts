import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { db } from '@/db/sessions/sessions';
import { deleteApiKey } from '@/db/apiKey/apiKey';

afterEach(async () => {
  cleanup();
  await db.sessions.clear();
  await deleteApiKey();
});

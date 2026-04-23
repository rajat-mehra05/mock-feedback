import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { platform, SECRET_OPENAI_API_KEY } from '@/platform';
import { _resetWebPlatformForTests } from '@/platform/web';
import { server } from '@/test/msw/server';

// jsdom matchMedia stub for detectPlatform's standalone check.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

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

import { test, expect } from 'vitest';
import { runtimeCaching } from './workboxConfig';

// Security invariant: no Workbox route may touch api.openai.com or api.github.com (credentials).
const FORBIDDEN_HOSTS = ['api.openai.com', 'api.github.com'];

// Multiple paths per host so a path-only regex matcher would also get caught.
const FORBIDDEN_PATHS: Record<string, string[]> = {
  'api.openai.com': [
    '/v1/chat/completions',
    '/v1/audio/transcriptions',
    '/v1/audio/speech',
    '/v1/models',
    '/v1/files',
  ],
  'api.github.com': ['/repos/rajat-mehra05/voice-round/releases/latest'],
};

function matchesUrl(
  pattern: RegExp | ((options: { request: Request; url: URL }) => boolean),
  url: string,
): boolean {
  if (pattern instanceof RegExp) return pattern.test(url);
  const request = new Request(url);
  const parsed = new URL(url);
  return pattern({ request, url: parsed });
}

test('no runtime caching route matches any URL on credential-bearing hosts', () => {
  for (const host of FORBIDDEN_HOSTS) {
    const paths = FORBIDDEN_PATHS[host] ?? ['/'];
    for (const path of paths) {
      const url = `https://${host}${path}`;
      for (const route of runtimeCaching) {
        expect(
          matchesUrl(route.urlPattern, url),
          `Route with handler "${route.handler}" must not match ${url}. ` +
            `Any route touching ${host} must be removed; OpenAI / GitHub ` +
            `credential-bearing requests must bypass Workbox entirely.`,
        ).toBe(false);
      }
    }
  }
});

test('the navigation route only matches navigation requests', () => {
  const navRoute = runtimeCaching.find((r) => r.options?.cacheName === 'navigations');
  expect(navRoute, 'expected a route with cacheName "navigations"').toBeDefined();
  if (!navRoute || navRoute.urlPattern instanceof RegExp) {
    throw new Error('navigation route should be a function matcher');
  }

  // Stub Request shape; matcher only inspects .mode (real Request defaults to "cors").
  const navigateRequest = { mode: 'navigate' } as Request;
  const corsRequest = { mode: 'cors' } as Request;

  expect(
    navRoute.urlPattern({ request: navigateRequest, url: new URL('https://example.com/') }),
  ).toBe(true);
  expect(
    navRoute.urlPattern({ request: corsRequest, url: new URL('https://example.com/api') }),
  ).toBe(false);
});

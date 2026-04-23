import { test, expect } from 'vitest';
import { runtimeCaching } from './workboxConfig';

// Security invariant: no Workbox route may match credential-bearing URLs
// (api.openai.com) or third-party APIs the SW shouldn't see (api.github.com).
//
// Every fetch passes through the SW's fetch handler. With no matching
// Workbox route, the request falls through to the default network path
// without inspection or caching. Any matching route adds code surface
// area (route matching, response cloning, plugin chains) where a future
// bug could turn into a credential leak.
//
// If you genuinely need to cache OpenAI metadata (model lists, etc.),
// add the route to a separate config object with a whitelist; do not
// loosen this test.

// Hosts that no Workbox route may match, period — regardless of which
// path is being fetched. Asserting host-level rather than full-URL means
// a future "/v1/files" or "/v1/models" call also can't slip through.
const FORBIDDEN_HOSTS = ['api.openai.com', 'api.github.com'];

// A spread of paths per host so a route that uses a path-only regex
// would still get caught alongside a full-URL pattern. Add new paths
// as the app starts hitting them.
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
  // Function patterns get a synthetic Request + URL. The matcher in
  // workboxConfig.ts only inspects request.mode, but pass both for
  // robustness against future matcher logic.
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
  // Navigation requests have request.mode === 'navigate'. A regular fetch
  // (mode 'cors' or 'no-cors') must not match the navigation handler.
  const navRoute = runtimeCaching.find((r) => r.options?.cacheName === 'navigations');
  expect(navRoute, 'expected a route with cacheName "navigations"').toBeDefined();
  if (!navRoute || navRoute.urlPattern instanceof RegExp) {
    throw new Error('navigation route should be a function matcher');
  }

  // Synthetic minimal Request shape. The matcher only inspects .mode, so a
  // typed stub avoids constructing a real Request (whose mode would default
  // to "cors" / "no-cors", neither of which is "navigate").
  const navigateRequest = { mode: 'navigate' } as Request;
  const corsRequest = { mode: 'cors' } as Request;

  expect(
    navRoute.urlPattern({ request: navigateRequest, url: new URL('https://example.com/') }),
  ).toBe(true);
  expect(
    navRoute.urlPattern({ request: corsRequest, url: new URL('https://example.com/api') }),
  ).toBe(false);
});

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

const FORBIDDEN_URLS = [
  'https://api.openai.com/v1/chat/completions',
  'https://api.openai.com/v1/audio/transcriptions',
  'https://api.openai.com/v1/audio/speech',
  'https://api.github.com/repos/rajat-mehra05/voice-round/releases/latest',
];

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

test('no runtime caching route matches credential-bearing URLs', () => {
  for (const url of FORBIDDEN_URLS) {
    for (const route of runtimeCaching) {
      expect(
        matchesUrl(route.urlPattern, url),
        `Route with handler "${route.handler}" must not match ${url}. ` +
          `OpenAI / GitHub credential-bearing requests must bypass Workbox entirely.`,
      ).toBe(false);
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

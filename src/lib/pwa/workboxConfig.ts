// Workbox runtime caching config for the web/PWA build.
// Lives outside vite.config.ts so it can be imported by a unit test that
// asserts no route matches credential-bearing URLs (api.openai.com).
//
// The handler strings ('NetworkFirst', etc.) are kept as plain strings
// rather than imported from workbox-strategies. They are typed by vite-plugin-pwa
// and serialised to the generated SW at build time. Importing the runtime
// classes here would pull workbox into the test bundle for nothing.
//
// Type is loose on purpose: vite-plugin-pwa accepts a superset of
// workbox-build's RuntimeCaching shape and re-exports it through a deep
// path. Pinning the type here would only churn on plugin upgrades.

export interface PwaRuntimeRoute {
  urlPattern: RegExp | ((options: { request: Request; url: URL }) => boolean);
  handler: 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate' | 'NetworkOnly' | 'CacheOnly';
  options?: {
    cacheName?: string;
    networkTimeoutSeconds?: number;
    expiration?: { maxEntries?: number; maxAgeSeconds?: number };
  };
}

// Navigation requests (HTML) use NetworkFirst with a 3s timeout falling back
// to the precached index. CacheFirst is wrong for navigations because cached
// HTML can reference hashed JS chunks that no longer exist on the CDN after
// a deploy, leaving offline users with a broken app. NetworkFirst always
// tries fresh first, only falls back to the precached shell when offline or
// the network is slow.
const navigationRoute: PwaRuntimeRoute = {
  urlPattern: ({ request }) => request.mode === 'navigate',
  handler: 'NetworkFirst',
  options: {
    cacheName: 'navigations',
    networkTimeoutSeconds: 3,
    // Bound the cache: this app has a handful of routes today, but a
    // future Vite SPA with many code-split routes could otherwise grow
    // the cache unbounded as users browse around. Daily expiry keeps
    // entries fresh enough that a stale 24h-old shell isn't typical.
    expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
  },
};

// IMPORTANT: Do NOT add a route that matches api.openai.com or api.github.com.
// Every fetch still passes through the SW's fetch handler (you cannot truly
// bypass a registered SW), but with no matching Workbox route Workbox falls
// through to the default network path without inspecting, caching, or
// transforming the request or response. Reducing the code surface area to
// zero on credential-bearing requests means a future routing bug can't turn
// into a credential leak.
//
// The unit test in workboxConfig.test.ts enforces this invariant.
export const runtimeCaching: PwaRuntimeRoute[] = [navigationRoute];

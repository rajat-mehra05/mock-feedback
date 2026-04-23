// Workbox runtime config; extracted so workboxConfig.test.ts can assert no credential routes.
// Strings (not workbox-strategies imports) keep workbox out of the test bundle.

export interface PwaRuntimeRoute {
  urlPattern: RegExp | ((options: { request: Request; url: URL }) => boolean);
  handler: 'CacheFirst' | 'NetworkFirst' | 'StaleWhileRevalidate' | 'NetworkOnly' | 'CacheOnly';
  options?: {
    cacheName?: string;
    networkTimeoutSeconds?: number;
    expiration?: { maxEntries?: number; maxAgeSeconds?: number };
  };
}

// NetworkFirst not CacheFirst because cached HTML refers to hashed chunks that vanish on deploy.
const navigationRoute: PwaRuntimeRoute = {
  urlPattern: ({ request }) => request.mode === 'navigate',
  handler: 'NetworkFirst',
  options: {
    cacheName: 'navigations',
    networkTimeoutSeconds: 3,
    expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
  },
};

// Do NOT add routes for api.openai.com or api.github.com. workboxConfig.test.ts enforces this.
export const runtimeCaching: PwaRuntimeRoute[] = [navigationRoute];

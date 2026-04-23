// Service Worker kill-switch.
//
// THIS FILE IS NOT ACTIVE BY DEFAULT. It only takes effect when deployed
// at /sw.js (the URL the live PWA registered against). Steps in
// README.md → Contributing → "Service Worker rollback runbook".
//
// What it does, in order, on the next visit by any controlled client:
//   1. Skips the standard install/wait phase and activates immediately.
//   2. Drops every Cache Storage entry the previous SW created.
//   3. Unregisters itself so the origin has zero registered SWs.
//   4. Force-reloads every controlled client. The reload misses the SW
//      controller (because we just unregistered) and the browser fetches
//      the (now SW-less) page fresh from the network.
//
// After this runs, the origin behaves as if no SW had ever been
// registered. A subsequent normal deploy can re-register a fresh SW
// without any leftover cache or controller state.

self.addEventListener('install', () => {
  // Skip the wait — take control on the next page load instead of
  // waiting for the user to close every tab.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Drop every cache. This includes Workbox precache, runtime
      //    caches, and anything else the previous SW touched.
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));

      // 2. Take control of every in-scope tab. Without claim() the
      //    kill-switch only controls clients that the previous SW was
      //    already controlling (or that register with the kill-switch
      //    on next load). claim() ensures matchAll() below returns the
      //    full set of in-scope windows so the reload reaches all of
      //    them on the first activation.
      await self.clients.claim();

      // 3. Unregister this SW so the origin reverts to no controller.
      //    Ordering matters: claim() before unregister(), otherwise
      //    the clients we want to reload are no longer considered
      //    controlled by the time we enumerate them.
      await self.registration.unregister();

      // 4. Force every controlled client to reload. The reload navigates
      //    to the same URL but no SW intercepts it this time, so the
      //    fetch hits the network and the app reloads clean.
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        // navigate() is preferred over postMessage('reload') because the
        // page might not have a listener for it. navigate to the same
        // URL is a hard refresh of that tab.
        if ('navigate' in client) {
          await client.navigate(client.url);
        }
      }
    })(),
  );
});

// Defensive: if a controlled page sends any fetch through us before
// activation finishes, just pass it through to the network with no
// modification. We never want to serve cached bytes from a kill-switch.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

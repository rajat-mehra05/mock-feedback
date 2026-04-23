// SW kill-switch. NOT ACTIVE; deploy at /sw.js per the README runbook.
// On activate: drop all caches, claim clients, unregister, force-reload every tab.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));

      // claim() before unregister(); otherwise matchAll() below misses tabs not yet controlled.
      await self.clients.claim();
      await self.registration.unregister();

      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        if ('navigate' in client) {
          await client.navigate(client.url);
        }
      }
    })(),
  );
});

// Pass through; never serve cached bytes from a kill-switch.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

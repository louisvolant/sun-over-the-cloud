// Service Worker for Sun Over The Cloud PWA
//
// Caching rules:
// - Bump CACHE_NAME whenever this file changes so `activate` purges every older
//   cache (including a stale HTML document pinning chunk URLs from a previous
//   deployment).
// - PRECACHE_ASSETS must only list files that actually exist: cache.addAll() is
//   atomic, so a single 404 used to make the whole install fail.
// - Static assets are served cache-first (their filenames are content-hashed),
//   with a network fallback that is retried once before giving up.
const CACHE_NAME = 'sun-over-the-cloud-v3';
const MAX_CACHE_ENTRIES = 300;
const PRECACHE_ASSETS = ['/manifest.json', '/icon.png', '/icon.svg'];

const OFFLINE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  '<title>Sun Over The Cloud</title></head><body>' +
  '<main style="font-family: system-ui, sans-serif; padding: 2rem; text-align: center;">' +
  '<h1>You are offline</h1><p>Reconnect to load the latest weather.</p>' +
  '</main></body></html>';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // Precache independently: one missing asset must not block activation.
        Promise.all(PRECACHE_ASSETS.map((asset) => cache.add(asset).catch(() => undefined)))
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => trimCache())
      .then(() => self.clients.claim())
  );
});

/** Keep the cache bounded so storage-quota errors cannot silently stop writes. */
async function trimCache() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  const excess = keys.length - MAX_CACHE_ENTRIES;
  if (excess <= 0) return;
  await Promise.all(keys.slice(0, excess).map((key) => cache.delete(key)));
}

/** Fetch a request, retrying once after a short delay (cold network hiccups). */
async function fetchWithRetry(request) {
  try {
    return await fetch(request);
  } catch (error) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return fetch(request);
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept cross-origin requests or dynamic backend/auth APIs.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Treat document navigations AND Next.js App Router RSC payloads as
  // network-first with cache: 'no-store' so deployed UI updates are reflected
  // immediately without needing to kill and restart the installed PWA.
  const isRscRequest =
    url.searchParams.has('_rsc') ||
    request.headers.get('RSC') === '1' ||
    request.headers.get('Next-Router-Prefetch') === '1';
  const isNavigation = request.mode === 'navigate';

  if (isNavigation || isRscRequest) {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request, { cache: 'no-store' });
          if (response && response.ok && isNavigation) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => undefined)
            );
          }
          return response;
        } catch (error) {
          const cached =
            (await caches.match(request)) || (isNavigation ? await caches.match('/') : undefined);
          if (cached) return cached;
          if (isNavigation) {
            return new Response(OFFLINE_HTML, {
              status: 503,
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          }
          return Response.error();
        }
      })()
    );
    return;
  }

  // Static assets (icons, hashed /_next/static/* chunks, fonts): cache-first.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;

      try {
        const response = await fetchWithRetry(request);
        if (response && response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch(() => undefined)
          );
        }
        return response;
      } catch (error) {
        // Never resolve respondWith() with undefined: Firefox reports that as a
        // hard "failed to load the <script>" error.
        return Response.error();
      }
    })()
  );
});

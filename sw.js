// Service Worker for One Buffalo Tracker
const CACHE_NAME = 'one-buffalo-v2';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './bills.html',
  './sabres.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './data.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Only intercept GET requests
  if (event.request.method !== 'GET') return;

  // 2. Bypass live external APIs and Analytics (always live network fetch)
  if (
    url.hostname.includes('espn.com') ||
    url.hostname.includes('umami.is') ||
    url.hostname.includes('clarity.ms')
  ) {
    return;
  }

  // 3. data.json: Network-first strategy with cache fallback
  if (url.pathname.endsWith('/data.json') || url.pathname.endsWith('data.json')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 4. App shell & static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Network offline; cached response handles it if available
        });

      return cachedResponse || fetchPromise;
    })
  );
});

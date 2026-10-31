// Service Worker for One Buffalo Tracker
const CACHE_NAME = 'one-buffalo-v8';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './bills.html',
  './sabres.html',
  './assets/shared.css',
  './assets/shared.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './og-card.png',
  './favicon.ico',
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

  // 2. Bypass all cross-origin requests (live external APIs, analytics, CDNs)
  if (
    url.origin !== self.location.origin ||
    url.hostname.includes('espn.com') ||
    url.hostname.includes('umami.is') ||
    url.hostname.includes('clarity.ms')
  ) {
    return;
  }

  // 3. data.json: Network-first strategy with single normalized cache entry (prevents ?v= cache bloat)
  if (url.pathname.endsWith('/data.json') || url.pathname.endsWith('data.json')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('./data.json', clone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('./data.json')
            .then((cached) => cached || caches.match(event.request, { ignoreSearch: true }));
        })
    );
    return;
  }

  // 4. App shell & static assets: Stale-While-Revalidate (normalized by pathname)
  const cleanUrl = url.origin + url.pathname;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(cleanUrl, clone));
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

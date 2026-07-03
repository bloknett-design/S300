// Service Worker for S300 Glossary PWA
// Strategy: cache-first for app shell, stale-while-revalidate for everything else
const CACHE_VERSION = 's300-glossary-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './pwa/icon-192.png',
  './pwa/icon-512.png',
  './pwa/icon-192-maskable.png',
  './pwa/icon-512-maskable.png',
  './pwa/apple-touch-icon.png',
  './pwa/favicon.png',
  'https://fonts.googleapis.com/',  // external (won't be cached, just allowed)
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL.filter(u => !u.startsWith('http'))))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] install error:', err))
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: stale-while-revalidate, with navigation fallback to index.html
self.addEventListener('fetch', (event) => {
  const req = event.request;
  
  // Only handle GET
  if (req.method !== 'GET') return;
  
  // Skip cross-origin requests (e.g. external CDN fonts)
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  
  // Navigation requests: try network first, fall back to cached index.html (app shell)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkResp) => {
        // Cache successful responses
        if (networkResp && networkResp.status === 200 && networkResp.type === 'basic') {
          const respClone = networkResp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, respClone));
        }
        return networkResp;
      }).catch(() => cached);  // offline fallback
      
      return cached || fetchPromise;
    })
  );
});

// Allow page to trigger update
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

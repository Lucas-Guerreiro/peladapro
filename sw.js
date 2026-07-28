// ==========================================================================
// Service Worker — PeladaPro PWA
// ==========================================================================

const CACHE_NAME = 'peladapro-v2';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './css/main.css',
  './css/components.css',
  './css/responsive.css',
  './style.css',
  './js/core/utils.js',
  './js/team_emblems.js',
  './js/services/pix_ocr.js',
  './js/core/api.js',
  './js/core/auth.js',
  './js/core/router.js',
  './js/pwa_installer.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Pre-cache parcial de recursos:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignora chamadas dinâmicas para o backend
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {});
    })
  );
});

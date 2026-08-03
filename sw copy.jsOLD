// ==========================================================================
// Service Worker — PeladaPro PWA & Push Notifications
// ==========================================================================

const CACHE_NAME = 'peladapro-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/css/main.css',
  '/css/components.css',
  '/css/responsive.css',
  '/style.css',
  '/js/core/utils.js',
  '/js/team_emblems.js',
  '/js/services/pix_ocr.js',
  '/js/core/api.js',
  '/js/core/auth.js',
  '/js/core/router.js',
  '/js/pwa_installer.js',
  '/js/pwa_push.js'
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
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch(() => {});
    })
  );
});

// ==========================================================================
// 🔔 PUSH NOTIFICATIONS LISTENERS
// ==========================================================================

// Listener do evento 'push' (Recebe notificações do servidor Web-Push)
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'PeladaPro ⚽', body: event.data.text() };
    }
  } else {
    data = {
      title: 'PeladaPro ⚽',
      body: 'Você recebeu uma novidade sobre a pelada!'
    };
  }

  const title = data.title || 'PeladaPro ⚽';
  const options = {
    body: data.body || 'Nova notificação da pelada!',
    icon: data.icon || '/assets/icons/push-icon-192.png',
    badge: '/assets/icons/push-icon-192.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || '/#/jogador/convocacao',
      dateOfArrival: Date.now()
    },
    actions: [
      { action: 'open', title: '⚽ Ver Pelada' },
      { action: 'close', title: 'Fechar' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Listener do evento 'notificationclick' (Clique na notificação)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  const urlToOpen = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/#/jogador/convocacao';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
